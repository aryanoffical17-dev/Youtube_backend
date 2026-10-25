import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const paging = (page, limit) => {
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    if (!Number.isInteger(pageNumber) || !Number.isInteger(limitNumber) || pageNumber < 1 || limitNumber < 1 || limitNumber > 50) {
        throw new ApiError(400, "Page must be positive and limit must be between 1 and 50");
    }
    return { pageNumber, limitNumber, skip: (pageNumber - 1) * limitNumber };
};

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    if (!mongoose.isValidObjectId(channelId)) throw new ApiError(400, "Invalid channelId");
    if (String(req.user._id) === channelId) throw new ApiError(400, "You cannot subscribe to your own channel");
    if (!(await User.exists({ _id: channelId }))) throw new ApiError(404, "Channel not found");

    const filter = { subscriber: req.user._id, channel: channelId };
    const existing = await Subscription.findOneAndDelete(filter);
    if (existing) {
        return res.status(200).json(new ApiResponse(200, { subscribed: false }, "Unsubscribed successfully"));
    }
    await Subscription.create(filter);
    return res.status(200).json(new ApiResponse(200, { subscribed: true }, "Subscribed successfully"));
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    if (!mongoose.isValidObjectId(channelId)) throw new ApiError(400, "Invalid channelId");
    if (!(await User.exists({ _id: channelId }))) throw new ApiError(404, "Channel not found");
    const page = paging(req.query.page ?? 1, req.query.limit ?? 10);
    const filter = { channel: channelId };
    const [subscriptions, total] = await Promise.all([
        Subscription.find(filter).populate("subscriber", "fullName username avatar").sort({ createdAt: -1 }).skip(page.skip).limit(page.limitNumber),
        Subscription.countDocuments(filter),
    ]);
    return res.status(200).json(new ApiResponse(200, {
        subscribers: subscriptions.map(({ subscriber }) => subscriber).filter(Boolean),
        pagination: { total, page: page.pageNumber, limit: page.limitNumber, totalPages: Math.ceil(total / page.limitNumber) },
    }, "Subscribers fetched successfully"));
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, "Invalid userId");
    if (!(await User.exists({ _id: userId }))) throw new ApiError(404, "User not found");
    const page = paging(req.query.page ?? 1, req.query.limit ?? 10);
    const filter = { subscriber: userId };
    const [subscriptions, total] = await Promise.all([
        Subscription.find(filter).populate("channel", "fullName username avatar").sort({ createdAt: -1 }).skip(page.skip).limit(page.limitNumber),
        Subscription.countDocuments(filter),
    ]);
    return res.status(200).json(new ApiResponse(200, {
        channels: subscriptions.map(({ channel }) => channel).filter(Boolean),
        pagination: { total, page: page.pageNumber, limit: page.limitNumber, totalPages: Math.ceil(total / page.limitNumber) },
    }, "Subscribed channels fetched successfully"));
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
