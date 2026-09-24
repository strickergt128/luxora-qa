import express from "express";
import {
  globalSearch,
  trendingSearches,
} from "../controllers/searchController.js";

const router = express.Router();

router.get("/", globalSearch);
router.get("/trending", trendingSearches); // ✅ new route

export default router;
