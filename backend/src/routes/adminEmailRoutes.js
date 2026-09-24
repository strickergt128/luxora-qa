import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  requireAdminMFA,
  requirePermissions,
} from "../middleware/roleMiddleware.js";
import {
  listTemplates,
  getTemplate,
  saveTemplate,
  renderPreview,
} from "../controllers/emailTemplateController.js";

const router = express.Router();

// Enforce admin/subadmin with MFA
router.use(protect, requireAdminMFA);

// Read
router.get("/", requirePermissions("emailTemplates:read"), listTemplates);
router.get("/:key", requirePermissions("emailTemplates:read"), getTemplate);

// Write
router.put("/:key", requirePermissions("emailTemplates:write"), saveTemplate);

// Preview (read)
router.post(
  "/render",
  requirePermissions("emailTemplates:read"),
  renderPreview
);

export default router;
