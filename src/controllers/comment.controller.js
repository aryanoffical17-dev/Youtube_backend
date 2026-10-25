import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const parsePagination = (page, limit) => {
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    if (!Number.isInteger(pageNumber) || !Number.isInteger(limitNumber) || pageNumber < 1 || limitNumber < 1 || limitNumber > 50) {
        throw new ApiError(400, "Page must be positive and limit must be between 1 and 50");
    }
    return { pageNumber, limitNumber, skip: (pageNumber - 1) * limitNumber };
};

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!mongoose.isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");
    const paging = parsePagination(req.query.page ?? 1, req.query.limit ?? 10);
    const filter = { video: videoId, isDeleted: false };
    const [comments, total] = await Promise.all([
        Comment.find(filter).populate("owner", "fullName username avatar").sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limitNumber),
        Comment.countDocuments(filter),
    ]);
    return res.status(200).json(new ApiResponse(200, {
        comments,
        pagination: { total, page: paging.pageNumber, limit: paging.limitNumber, totalPages: Math.ceil(total / paging.limitNumber) },
    }, "Comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const content = req.body.content ?? req.body.text;
    if (!mongoose.isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");
    if (typeof content !== "string" || !content.trim()) throw new ApiError(400, "Comment content is required");
    if (!(await Video.exists({ _id: videoId }))) throw new ApiError(404, "Video not found");

    const comment = await Comment.create({ video: videoId, content: content.trim(), owner: req.user._id });
    return res.status(201).json(new ApiResponse(201, comment, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const content = req.body.content ?? req.body.text;
    if (!mongoose.isValidObjectId(commentId)) throw new ApiError(400, "Invalid commentId");
    if (typeof content !== "string" || !content.trim()) throw new ApiError(400, "Comment content is required");

    const comment = await Comment.findOneAndUpdate(
        { _id: commentId, owner: req.user._id, isDeleted: false },
        { $set: { content: content.trim(), editedAt: new Date() } },
        { new: true, runValidators: true },
    );
    if (!comment) throw new ApiError(404, "Comment not found or unauthorized");
    return res.status(200).json(new ApiResponse(200, comment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    if (!mongoose.isValidObjectId(commentId)) throw new ApiError(400, "Invalid commentId");
    const comment = await Comment.findOneAndUpdate(
        { _id: commentId, owner: req.user._id, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true },
    );
    if (!comment) throw new ApiError(404, "Comment not found or unauthorized");
    return res.status(200).json(new ApiResponse(200, comment, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
