import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  requireAdminMFA,
  requirePermissions,
} from "../middleware/roleMiddleware.js";
import {
  listMedia,
  uploadMedia,
  deleteMedia,
} from "../controllers/mediaController.js";

const router = express.Router();

// Enforce admin/subadmin with MFA
router.use(protect, requireAdminMFA);

// Read
router.get("/", requirePermissions("media:read"), listMedia);

// Write
router.post("/", requirePermissions("media:write"), uploadMedia);
router.delete("/:filename", requirePermissions("media:write"), deleteMedia);

export default router;
