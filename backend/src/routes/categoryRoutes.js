// backend/src/routes/categoryRoutes.js
import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  importCategories,
} from "../controllers/categoryController.js";

const router = express.Router();

// public
router.get("/", listCategories);

// admin
router.post("/", protect, authorizeRoles("admin"), createCategory);
router.patch("/:id", protect, authorizeRoles("admin"), updateCategory);
router.delete("/:id", protect, authorizeRoles("admin"), deleteCategory);
router.post("/import", protect, authorizeRoles("admin"), importCategories);

export default router;
