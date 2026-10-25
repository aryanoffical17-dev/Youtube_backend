import "dotenv/config";
import express from 'express';
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "node:fs/promises";
import userRoutes from "./routes/user.routes.js";
import videoRoutes from "./routes/videos.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import likeRoutes from "./routes/like.routes.js";
import playlistRoutes from "./routes/playlist.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import tweetRoutes from "./routes/tweet.routes.js";

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];

app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
}));

app.use(express.json({
    limit: "20kb",
}));

app.use(express.urlencoded({
    extended: true,
    limit: "20kb",
}));
app.use(cookieParser());

// Express 5 leaves req.body undefined when a request has no body, which made
// every `const { x } = req.body` crash with a 500. Default it to an empty object.
app.use((req, _res, next) => {
    req.body ??= {};
    next();
});

// Multer writes uploads to public/temp before validation runs. Remove whatever is
// still on disk once the request ends so failed requests don't leak files.
const removeUploadedFiles = (req) => {
    const uploaded = [];
    if (req.file) uploaded.push(req.file);
    if (Array.isArray(req.files)) uploaded.push(...req.files);
    else if (req.files) uploaded.push(...Object.values(req.files).flat());
    return Promise.all(uploaded.map(({ path }) => fs.unlink(path).catch(() => {})));
};
app.use((req, res, next) => {
    res.on("close", () => { void removeUploadedFiles(req); });
    next();
});

// In-flight uploads live in public/temp; never serve them.
app.use("/temp", (_req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});
app.use(express.static("public"));

app.get("/api/v1/health", (_req, res) => res.status(200).json({ success: true, message: "API is healthy" }));
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/videos", videoRoutes);
app.use("/api/v1/comments", commentRoutes);
app.use("/api/v1/likes", likeRoutes);
app.use("/api/v1/playlist", playlistRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/tweets", tweetRoutes);

app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode
        || (err.code === 11000 ? 409 : err.name === "ValidationError" || err.type === "entity.parse.failed" ? 400 : err.code === "LIMIT_FILE_SIZE" ? 413 : err.name === "MulterError" || err.name === "CastError" ? 400 : 500);
    res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? "Internal server error" : err.message,
        errors: err.errors ?? [],
    });
});

export{app};