import mongoose from "mongoose";
import { Playlist } from "../models/playlist.models.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description = "" } = req.body;
    if (typeof name !== "string" || !name.trim() || typeof description !== "string") {
        throw new ApiError(400, "Playlist name and a valid description are required");
    }
    const playlist = await Playlist.create({ name: name.trim(), description: description.trim(), owner: req.user._id });
    return res.status(201).json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, "Invalid userId");
    if (!(await User.exists({ _id: userId }))) throw new ApiError(404, "User not found");
    const playlists = await Playlist.find({ owner: userId }).populate("videos").sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, playlists, "User playlists fetched successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.playlistId)) throw new ApiError(400, "Invalid playlistId");
    const playlist = await Playlist.findById(req.params.playlistId).populate("videos");
    if (!playlist) throw new ApiError(404, "Playlist not found");
    return res.status(200).json(new ApiResponse(200, playlist, "Playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;
    if (!mongoose.isValidObjectId(playlistId) || !mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlistId or videoId");
    }
    if (!(await Video.exists({ _id: videoId }))) throw new ApiError(404, "Video not found");
    const playlist = await Playlist.findOneAndUpdate(
        { _id: playlistId, owner: req.user._id },
        { $addToSet: { videos: videoId } },
        { new: true },
    ).populate("videos");
    if (!playlist) throw new ApiError(404, "Playlist not found or unauthorized");
    return res.status(200).json(new ApiResponse(200, playlist, "Video added to playlist"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;
    if (!mongoose.isValidObjectId(playlistId) || !mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlistId or videoId");
    }
    const playlist = await Playlist.findOneAndUpdate(
        { _id: playlistId, owner: req.user._id },
        { $pull: { videos: videoId } },
        { new: true },
    ).populate("videos");
    if (!playlist) throw new ApiError(404, "Playlist not found or unauthorized");
    return res.status(200).json(new ApiResponse(200, playlist, "Video removed from playlist"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.playlistId)) throw new ApiError(400, "Invalid playlistId");
    const playlist = await Playlist.findOneAndDelete({ _id: req.params.playlistId, owner: req.user._id });
    if (!playlist) throw new ApiError(404, "Playlist not found or unauthorized");
    return res.status(200).json(new ApiResponse(200, playlist, "Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { name, description } = req.body;
    if (!mongoose.isValidObjectId(playlistId)) throw new ApiError(400, "Invalid playlistId");
    const updates = {};
    if (name !== undefined) {
        if (typeof name !== "string" || !name.trim()) throw new ApiError(400, "Playlist name must not be empty");
        updates.name = name.trim();
    }
    if (description !== undefined) {
        if (typeof description !== "string") throw new ApiError(400, "Description must be a string");
        updates.description = description.trim();
    }
    if (!Object.keys(updates).length) throw new ApiError(400, "Provide a name or description to update");
    const playlist = await Playlist.findOneAndUpdate(
        { _id: playlistId, owner: req.user._id },
        { $set: updates },
        { new: true, runValidators: true },
    );
    if (!playlist) throw new ApiError(404, "Playlist not found or unauthorized");
    return res.status(200).json(new ApiResponse(200, playlist, "Playlist updated successfully"));
});

export { createPlaylist, getUserPlaylists, getPlaylistById, addVideoToPlaylist, removeVideoFromPlaylist, deletePlaylist, updatePlaylist };
