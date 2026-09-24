import express from "express";
import {
  protect,
  authorizeRoles,
  attachUserIfPresent,
} from "../middleware/authMiddleware.js";
import upload from "../config/storage.js";
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  setProductStatus,
  getAlsoBought,
} from "../controllers/productController.js";

const router = express.Router();

// List + create
router
  .route("/")
  .get(attachUserIfPresent, listProducts)
  .post(
    protect,
    authorizeRoles("seller", "admin"),
    upload.fields([
      { name: "images", maxCount: 8 },
      { name: "video", maxCount: 1 },
    ]),
    createProduct
  );

// Also bought (must be before /:id)
router.get("/:id/also-bought", getAlsoBought);

// Get / update / delete
router
  .route("/:id")
  .get(getProduct)
  .put(
    protect,
    authorizeRoles("seller", "admin"),
    upload.fields([
      { name: "images", maxCount: 8 },
      { name: "video", maxCount: 1 },
    ]),
    updateProduct
  )
  .delete(protect, authorizeRoles("seller", "admin"), deleteProduct);

// Admin status
router.patch("/:id/status", protect, authorizeRoles("admin"), setProductStatus);

export default router;
