import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";





export const verifyJWT = asyncHandler(async (req, _res, next) => {
    const authorization = req.get("Authorization");
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const cookieToken = req.cookies?.accessToken ?? req.cookies?.accesstoken;
    // An explicit Authorization header can't be sent cross-site without a CORS
    // preflight, so it is safe from CSRF and takes priority over a (possibly stale) cookie.
    const token = bearerToken ?? cookieToken;

    if (!token) {
        throw new ApiError(401, "Unauthorized");
    }

    if (!bearerToken && cookieToken && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean)
            .map((origin) => {
                try {
                    return new URL(origin).origin;
                } catch {
                    throw new ApiError(500, "Invalid CORS_ORIGIN configuration");
                }
            });
        const requestOrigin = req.get("Origin");
        if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
            throw new ApiError(403, "Request origin is not allowed");
        }
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch {
        throw new ApiError(401, "Invalid or expired access token");
    }

    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    if (!user) {
        throw new ApiError(401, "Unauthorized");
    }

    req.user = user;
    next();
});
