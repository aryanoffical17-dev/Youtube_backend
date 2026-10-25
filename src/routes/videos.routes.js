import { Router } from "express";
import { publishAVideo, deleteVideo, getAllVideos, getVideoById, updateVideo, togglePublishStatus } from "../controllers/videos.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router();
router.use(verifyJWT)

router.route("/").get(getAllVideos).post(upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
]),
    publishAVideo

);

router.route("/:videoId").get(getVideoById).delete(deleteVideo).patch(upload.single("thumbnail"), updateVideo);

router.route("/:videoId/toggle-publish").patch(togglePublishStatus);

export default router
