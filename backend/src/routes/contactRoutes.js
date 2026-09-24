import express from "express";
import multer from "multer";
import { submitContact } from "../controllers/contactController.js";
import { limitContact } from "../middleware/rateLimit.js";
import { verifyHCaptcha } from "../middleware/captcha.js";

const router = express.Router();

// Multer: memory storage, images only, up to 3 files, 5MB each
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 3, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(null, false);
  },
});

// Order: rate limit (IP), parse multipart, then verify hCaptcha (needs body), then controller
router.post(
  "/",
  limitContact,
  upload.array("attachments", 3),
  verifyHCaptcha(),
  submitContact
);

export default router;
