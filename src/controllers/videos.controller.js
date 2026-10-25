import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Playlist } from "../models/playlist.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const pagination = (page, limit) => {
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    if (!Number.isInteger(pageNumber) || !Number.isInteger(limitNumber) || pageNumber < 1 || limitNumber < 1 || limitNumber > 50) {
        throw new ApiError(400, "Page must be positive and limit must be between 1 and 50");
    }
    return { pageNumber, limitNumber, skip: (pageNumber - 1) * limitNumber };
};

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc", userId } = req.query;
    const paging = pagination(page, limit);
    const filter = { publish: true };

    if (query !== undefined) {
        if (typeof query !== "string") throw new ApiError(400, "Query must be a string");
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [{ title: { $regex: escaped, $options: "i" } }, { description: { $regex: escaped, $options: "i" } }];
    }
    if (userId) {
        if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, "Invalid userId");
        filter.owner = userId;
        // Owners must be able to see their own unpublished videos.
        if (String(userId) === String(req.user._id)) delete filter.publish;
    }
    if (!["createdAt", "title", "views"].includes(sortBy) || !["asc", "desc"].includes(sortType)) {
        throw new ApiError(400, "Invalid sort configuration");
    }

    const sort = { [sortBy]: sortType === "asc" ? 1 : -1 };
    const [videos, totalVideos] = await Promise.all([
        Video.find(filter).populate("owner", "fullName username avatar").sort(sort).skip(paging.skip).limit(paging.limitNumber),
        Video.countDocuments(filter),
    ]);
    return res.status(200).json(new ApiResponse(200, {
        page: paging.pageNumber,
        limit: paging.limitNumber,
        totalVideos,
        totalPages: Math.ceil(totalVideos / paging.limitNumber),
        videos,
    }, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const videoPath = req.files?.videoFile?.[0]?.path;
    const thumbnailPath = req.files?.thumbnail?.[0]?.path;
    if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim()) {
        throw new ApiError(400, "Title and description are required");
    }
    if (!videoPath || !thumbnailPath) {
        throw new ApiError(400, "Video and thumbnail files are required");
    }

    const [videoUpload, thumbnailUpload] = await Promise.all([
        uploadOnCloudinary(videoPath),
        uploadOnCloudinary(thumbnailPath),
    ]);
    if (!videoUpload?.secure_url || !thumbnailUpload?.secure_url) {
        throw new ApiError(502, "Video or thumbnail upload failed");
    }
    const video = await Video.create({
        title: title.trim(),
        description: description.trim(),
        videoFile: videoUpload.secure_url,
        thumbnail: thumbnailUpload.secure_url,
        duration: Number(videoUpload.duration) || 0,
        owner: req.user._id,
    });
    return res.status(201).json(new ApiResponse(201, video, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!mongoose.isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

    const video = await Video.findOneAndUpdate(
        { _id: videoId, $or: [{ publish: true }, { owner: req.user._id }] },
        { $inc: { views: 1 } },
        { new: true },
    ).populate("owner", "fullName username avatar");
    if (!video) throw new ApiError(404, "Video not found");

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { watchHistory: video._id } });
    return res.status(200).json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;
    if (!mongoose.isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");
    const updates = {};
    if (title !== undefined) {
        if (typeof title !== "string" || !title.trim()) throw new ApiError(400, "Title must not be empty");
        updates.title = title.trim();
    }
    if (description !== undefined) {
        if (typeof description !== "string" || !description.trim()) throw new ApiError(400, "Description must not be empty");
        updates.description = description.trim();
    }
    if (req.file?.path) {
        const upload = await uploadOnCloudinary(req.file.path);
        if (!upload?.secure_url) throw new ApiError(502, "Thumbnail upload failed");
        updates.thumbnail = upload.secure_url;
    }
    if (!Object.keys(updates).length) throw new ApiError(400, "Provide a title, description, or thumbnail to update");

    const video = await Video.findOneAndUpdate({ _id: videoId, owner: req.user._id }, { $set: updates }, {
        new: true,
        runValidators: true,
    });
    if (!video) throw new ApiError(404, "Video not found or unauthorized");
    return res.status(200).json(new ApiResponse(200, video, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.videoId)) throw new ApiError(400, "Invalid videoId");
    const video = await Video.findOneAndDelete({ _id: req.params.videoId, owner: req.user._id });
    if (!video) throw new ApiError(404, "Video not found or unauthorized");

    // Remove everything that pointed at the deleted video.
    const commentIds = await Comment.find({ video: video._id }).distinct("_id");
    await Promise.all([
        Like.deleteMany({ $or: [{ video: video._id }, { comment: { $in: commentIds } }] }),
        Comment.deleteMany({ video: video._id }),
        Playlist.updateMany({ videos: video._id }, { $pull: { videos: video._id } }),
        User.updateMany({ watchHistory: video._id }, { $pull: { watchHistory: video._id } }),
    ]);
    return res.status(200).json(new ApiResponse(200, video, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.videoId)) throw new ApiError(400, "Invalid videoId");
    const video = await Video.findOne({ _id: req.params.videoId, owner: req.user._id });
    if (!video) throw new ApiError(404, "Video not found or unauthorized");
    video.publish = !video.publish;
    await video.save();
    return res.status(200).json(new ApiResponse(200, video, "Publish status toggled"));
});

export { getAllVideos, publishAVideo, getVideoById, updateVideo, deleteVideo, togglePublishStatus };
