import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
});

const issueTokens = async (user) => {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
};

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, fullname, email, password, username } = req.body;
    const nameValue = fullName ?? fullname;
    const name = typeof nameValue === "string" ? nameValue.trim() : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : "";

    if (![name, normalizedEmail, password, normalizedUsername].every((value) => typeof value === "string" && value.trim())) {
        throw new ApiError(400, "Full name, email, username, and password are required");
    }

    const avatarPath = req.files?.avatar?.[0]?.path;
    if (!avatarPath) {
        throw new ApiError(400, "Avatar image is required");
    }

    const existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });
    if (existingUser) {
        throw new ApiError(409, "An account with this email or username already exists");
    }

    const avatar = await uploadOnCloudinary(avatarPath);
    if (!avatar?.secure_url) {
        throw new ApiError(502, "Avatar upload failed");
    }

    const coverPath = req.files?.coverImage?.[0]?.path;
    const cover = coverPath ? await uploadOnCloudinary(coverPath) : null;
    if (coverPath && !cover?.secure_url) {
        throw new ApiError(502, "Cover image upload failed");
    }

    const user = await User.create({
        fullName: name,
        email: normalizedEmail,
        username: normalizedUsername,
        password,
        avatar: avatar.secure_url,
        ...(cover?.secure_url ? { coverImage: cover.secure_url } : {}),
    });

    const publicUser = await User.findById(user._id).select("-password -refreshToken");
    return res.status(201).json(new ApiResponse(201, publicUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
    const { identifier, email, username, password } = req.body;
    const identifierValue = identifier ?? username ?? email;
    const loginId = typeof identifierValue === "string" ? identifierValue.trim().toLowerCase() : "";
    if (!loginId || typeof password !== "string" || !password) {
        throw new ApiError(400, "Username or email and password are required");
    }

    const user = await User.findOne({
        $or: [{ username: loginId }, { email: loginId }],
    });
    if (!user || !(await user.isPasswordCorrect(password))) {
        throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = await issueTokens(user);
    const publicUser = await User.findById(user._id).select("-password -refreshToken");
    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions())
        .cookie("refreshToken", refreshToken, cookieOptions())
        .json(new ApiResponse(200, { user: publicUser, accessToken, refreshToken }, "Login successful"));
});

const logoutuser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions())
        .clearCookie("refreshToken", cookieOptions())
        .json(new ApiResponse(200, {}, "Logout successful"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken;
    if (!refreshToken) {
        throw new ApiError(401, "Refresh token is required");
    }

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
        throw new ApiError(401, "Invalid or expired refresh token");
    }

    const user = await User.findById(decoded._id);
    if (!user || user.refreshToken !== refreshToken) {
        throw new ApiError(401, "Invalid or expired refresh token");
    }

    const tokens = await issueTokens(user);
    return res
        .status(200)
        .cookie("accessToken", tokens.accessToken, cookieOptions())
        .cookie("refreshToken", tokens.refreshToken, cookieOptions())
        .json(new ApiResponse(200, tokens, "Access token refreshed successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        throw new ApiError(400, "Current password and a new password of at least 8 characters are required");
    }

    const user = await User.findById(req.user._id);
    if (!user || !(await user.isPasswordCorrect(oldPassword))) {
        throw new ApiError(400, "Current password is incorrect");
    }
    user.password = newPassword;
    await user.save();
    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) =>
    res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"))
);

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    const updates = {};
    if (fullName !== undefined) {
        if (typeof fullName !== "string" || !fullName.trim()) {
            throw new ApiError(400, "Full name must not be empty");
        }
        updates.fullName = fullName.trim();
    }
    if (email !== undefined) {
        if (typeof email !== "string" || !email.trim()) {
            throw new ApiError(400, "Email must not be empty");
        }
        updates.email = email.trim().toLowerCase();
    }
    if (!Object.keys(updates).length) {
        throw new ApiError(400, "Provide a full name or email to update");
    }

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, {
        new: true,
        runValidators: true,
    }).select("-password -refreshToken");
    return res.status(200).json(new ApiResponse(200, user, "Account updated successfully"));
});

const updateProfileImage = (field, label) => asyncHandler(async (req, res) => {
    if (!req.file?.path) {
        throw new ApiError(400, `${label} file is required`);
    }
    const upload = await uploadOnCloudinary(req.file.path);
    if (!upload?.secure_url) {
        throw new ApiError(502, `${label} upload failed`);
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { [field]: upload.secure_url } }, {
        new: true,
        runValidators: true,
    }).select("-password -refreshToken");
    return res.status(200).json(new ApiResponse(200, user, `${label} updated successfully`));
});

const updateUserAvatar = updateProfileImage("avatar", "Avatar");
const updateUserCoverImg = updateProfileImage("coverImage", "Cover image");

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const username = req.params.username?.trim().toLowerCase();
    if (!username) {
        throw new ApiError(400, "Username is required");
    }
    const channel = await User.findOne({ username }).select("-password -refreshToken");
    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    const [subscriberCount, channelsSubscribedToCount, subscription] = await Promise.all([
        Subscription.countDocuments({ channel: channel._id }),
        Subscription.countDocuments({ subscriber: channel._id }),
        Subscription.exists({ channel: channel._id, subscriber: req.user._id }),
    ]);
    return res.status(200).json(new ApiResponse(200, {
        ...channel.toObject(),
        subscriberCount,
        channelsSubscribedToCount,
        isSubscribed: Boolean(subscription),
    }, "Channel profile fetched successfully"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .select("watchHistory")
        .populate({ path: "watchHistory", populate: { path: "owner", select: "fullName username avatar" } });
    return res.status(200).json(new ApiResponse(200, user.watchHistory, "Watch history fetched successfully"));
});

export {
    registerUser,
    loginUser,
    logoutuser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImg,
    getUserChannelProfile,
    getWatchHistory,
};
