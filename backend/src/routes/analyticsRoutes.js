import express from "express";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { trackEvent } from "../controllers/analyticsController.js";

const router = express.Router();

// Simple IP rate limiter for analytics tracking (relaxed)
const limiter = new RateLimiterMemory({
  keyPrefix: "rl:analytics:track",
  points: 120, // events
  duration: 60, // per minute
});

const limitAnalytics = async (req, res, next) => {
  try {
    const key =
      (Array.isArray(req.headers["x-forwarded-for"])
        ? req.headers["x-forwarded-for"][0]
        : req.headers["x-forwarded-for"] || req.ip || ""
      )
        .toString()
        .split(",")[0]
        .trim() || "unknown";
    await limiter.consume(key);
    next();
  } catch (rejRes) {
    const retrySec = Math.ceil((rejRes?.msBeforeNext ?? 0) / 1000);
    if (retrySec > 0) res.set("Retry-After", String(retrySec));
    res.status(429).json({ message: "Too many events, please slow down" });
  }
};

// Public endpoint; no auth required
router.post("/track", limitAnalytics, trackEvent);

export default router;
