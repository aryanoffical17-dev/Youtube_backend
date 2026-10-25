import mongoose from "mongoose";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleLike = async (req, res, targetField, targetId, Model, label) => {
    if (!mongoose.isValidObjectId(targetId)) throw new ApiError(400, `Invalid ${label} ID`);
    if (!(await Model.exists({ _id: targetId }))) throw new ApiError(404, `${label} not found`);

    const filter = { [targetField]: targetId, likedBy: req.user._id };
    const existing = await Like.findOneAndDelete(filter);
    if (existing) {
        return res.status(200).json(new ApiResponse(200, { liked: false }, `${label} unliked`));
    }
    await Like.create(filter);
    return res.status(200).json(new ApiResponse(200, { liked: true }, `${label} liked`));
};

const toggleVideoLike = asyncHandler((req, res) =>
    toggleLike(req, res, "video", req.params.videoId, Video, "Video")
);
const toggleCommentLike = asyncHandler((req, res) =>
    toggleLike(req, res, "comment", req.params.commentId, Comment, "Comment")
);
const toggleTweetLike = asyncHandler((req, res) =>
    toggleLike(req, res, "tweet", req.params.tweetId, Tweet, "Tweet")
);

const getLikedVideos = asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    if (!Number.isInteger(page) || !Number.isInteger(limit) || page < 1 || limit < 1 || limit > 50) {
        throw new ApiError(400, "Page must be positive and limit must be between 1 and 50");
    }
    const filter = { likedBy: req.user._id, video: { $exists: true } };
    const [likes, total] = await Promise.all([
        Like.find(filter).populate({ path: "video", populate: { path: "owner", select: "fullName username avatar" } })
            .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Like.countDocuments(filter),
    ]);
    return res.status(200).json(new ApiResponse(200, {
        videos: likes.map((like) => like.video).filter(Boolean),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }, "Liked videos fetched successfully"));
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
