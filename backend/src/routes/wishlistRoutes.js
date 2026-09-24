import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getSharedWishlist,
  getWishlistShareStatus,
  enableWishlistShare,
  disableWishlistShare,
} from "../controllers/wishlistController.js";

const router = express.Router();

// Public: view a shared wishlist
router.get("/share/:id", getSharedWishlist);

// All below require login
router.use(protect);

router.get("/", getWishlist);
router.post("/", addToWishlist);
router.delete("/:productId", removeFromWishlist);

// Share controls (protected)
router.get("/share/status", getWishlistShareStatus);
router.post("/share/enable", enableWishlistShare);
router.post("/share/disable", disableWishlistShare);

export default router;
