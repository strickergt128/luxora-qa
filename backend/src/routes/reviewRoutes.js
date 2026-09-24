import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../config/storage.js";
import {
  addReview,
  getProductReviews,
} from "../controllers/reviewController.js";

const router = express.Router();

const maybeMultipart = (req, res, next) => {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) {
    return upload.fields([
      { name: "images", maxCount: 3 },
      { name: "video", maxCount: 1 },
    ])(req, res, next);
  }
  // Not multipart => skip multer, req.body will be parsed by express.json()
  return next();
};

// Add/update review with media or URL-only
router.post("/", protect, maybeMultipart, addReview);

// Public: product reviews
router.get("/:productId", getProductReviews);

export default router;
