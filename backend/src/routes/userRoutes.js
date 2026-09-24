import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  requestSellerRole,
  updateMe,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getPriceDropAlertsStatus,
  setPriceDropAlertsStatus,
} from "../controllers/userController.js";
import {
  getSellerOverview,
  getSellerSales,
} from "../controllers/analyticsController.js";
import { uploadFile } from "../controllers/uploadController.js";
import upload from "../config/storage.js";

const router = express.Router();

router.post("/seller-request", protect, requestSellerRole);
router.post("/apply/upload", protect, upload.single("file"), uploadFile);

// Profile
router.patch("/me", protect, updateMe);
router.patch("/me/password", protect, changePassword);

// Addresses
router.post("/addresses", protect, addAddress);
router.put("/addresses/:id", protect, updateAddress);
router.delete("/addresses/:id", protect, deleteAddress);
router.patch("/addresses/:id/default", protect, setDefaultAddress);

router.get(
  "/analytics/overview",
  protect,
  authorizeRoles("seller"),
  getSellerOverview
);
router.get(
  "/analytics/sales",
  protect,
  authorizeRoles("seller"),
  getSellerSales
);

router.get("/me/alerts/price-drop", protect, getPriceDropAlertsStatus);
router.post("/me/alerts/price-drop", protect, setPriceDropAlertsStatus);

export default router;
