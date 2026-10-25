import multer from "multer";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { ApiError } from "../utils/apiError.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const uploadDir = path.join(projectRoot, "public", "temp");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const allowedMimePrefix = {
    avatar: "image/",
    coverImage: "image/",
    thumbnail: "image/",
    videoFile: "video/",
};
const fileFilter = (_req, file, cb) => {
    const prefix = allowedMimePrefix[file.fieldname];
    if (prefix && file.mimetype.startsWith(prefix)) return cb(null, true);
    cb(new ApiError(400, prefix
        ? `${file.fieldname} must be ${prefix === "image/" ? "an image" : "a video"} file`
        : `Unexpected file field: ${file.fieldname}`));
};
export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 500 * 1024 * 1024 },
});