import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { requireAdminMFA } from "../middleware/roleMiddleware.js";
import {
  listPlacements,
  createPlacement,
  updatePlacement,
  deletePlacement,
} from "../controllers/sponsoredController.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin", "subadmin"), requireAdminMFA);

router.get("/", listPlacements);
router.post("/", createPlacement);
router.patch("/:id", updatePlacement);
router.delete("/:id", deletePlacement);

export default router;
