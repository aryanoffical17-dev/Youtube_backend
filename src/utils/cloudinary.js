import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import fs from "node:fs/promises";
import { ApiError } from "./apiError.js";

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (filePath) => {
    if (!filePath) {
        throw new Error("A local file path is required for Cloudinary upload");
    }
    try {
        return await cloudinary.uploader.upload(filePath, { resource_type: "auto" });
    } catch (error) {
        console.error("Cloudinary upload failed:", error?.message ?? error);
        throw new ApiError(502, "Media upload failed");
    } finally {
        await fs.unlink(filePath).catch((error) => {
            if (error.code !== "ENOENT") throw error;
        });
    }
};

export { uploadOnCloudinary };
