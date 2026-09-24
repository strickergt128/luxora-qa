import express from "express";
import {
  getActiveBanner,
  recordImpression,
  recordClick,
} from "../controllers/bannerController.js";

const router = express.Router();

// Public
router.get("/active", getActiveBanner);
router.post("/:id/impression", recordImpression);
router.post("/:id/click", recordClick);

export default router;
