import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  requireAdminMFA,
  requirePermissions,
} from "../middleware/roleMiddleware.js";
import {
  createCoupon,
  listCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,
} from "../controllers/couponController.js";

const router = express.Router();

// Enforce admin/subadmin with MFA
router.use(protect, requireAdminMFA);

// Write
router.post("/", requirePermissions("coupons:write"), createCoupon);
router.patch("/:id", requirePermissions("coupons:write"), updateCoupon);
router.delete("/:id", requirePermissions("coupons:write"), deleteCoupon);

// Read
router.get("/", requirePermissions("coupons:read"), listCoupons);
router.get("/:id", requirePermissions("coupons:read"), getCoupon);

export default router;
