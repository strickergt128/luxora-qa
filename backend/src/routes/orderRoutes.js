import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import upload from "../config/storage.js";
import {
  placeOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  getOrderAuditForUser,
  createReturnRequest,
  getMyReturnRequests,
} from "../controllers/orderController.js";

const router = express.Router();

router.post("/", protect, placeOrder);
router.get("/my", protect, getMyOrders);
router.get("/:id", protect, getOrderById);
router.get("/:id/audit", protect, getOrderAuditForUser);

// Returns
router.post(
  "/:id/returns",
  protect,
  upload.single("file"),
  createReturnRequest
);
router.get("/:id/returns", protect, getMyReturnRequests);

// Admin-only status change (also available in /api/admin/orders/:id/status)
router.patch(
  "/:id/status",
  protect,
  authorizeRoles("admin"),
  updateOrderStatus
);

export default router;
