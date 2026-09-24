import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import helmet from "helmet";

import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";
import productRoutes from "./src/routes/productRoutes.js";
import cartRoutes from "./src/routes/cartRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import reviewRoutes from "./src/routes/reviewRoutes.js";
import wishlistRoutes from "./src/routes/wishlistRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import sellerRoutes from "./src/routes/sellerRoutes.js";
import adminEmailRoutes from "./src/routes/adminEmailRoutes.js";
import categoryRoutes from "./src/routes/categoryRoutes.js";
import adminMediaRoutes from "./src/routes/adminMediaRoutes.js";
import adminCouponRoutes from "./src/routes/adminCouponRoutes.js";
import testEmailRoutes from "./src/routes/testEmail.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import searchRoutes from "./src/routes/searchRoutes.js";
import contactRoutes from "./src/routes/contactRoutes.js";
import adminBannerRoutes from "./src/routes/adminBannerRoutes.js";
import bannerRoutes from "./src/routes/bannerRoutes.js";
import adminSponsoredRoutes from "./src/routes/adminSponsoredRoutes.js";
import sponsoredRoutes from "./src/routes/sponsoredRoutes.js";

// Load environment variables silently
dotenv.config({ path: ".env" });

const app = express();

// If behind a reverse proxy (nginx, Vercel, etc.)
app.set("trust proxy", 1);

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
const allowedOrigins = String(
  process.env.CORS_ORIGINS || "http://localhost:3000"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients and same-origin requests with no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  })
);
app.use(cookieParser());
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}
app.use(helmet()); 

// API Routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/emails", adminEmailRoutes);
app.use("/api/admin/media", adminMediaRoutes);
app.use("/api/admin/coupons", adminCouponRoutes);
const enableTestEmailRoute =
  String(process.env.ENABLE_TEST_EMAIL_ROUTE || "").toLowerCase() === "true";
if (enableTestEmailRoute && process.env.NODE_ENV !== "production") {
  app.use("/api/test-email", testEmailRoutes);
}
app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin/banners", adminBannerRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/admin/sponsored", adminSponsoredRoutes);
app.use("/api/sponsored", sponsoredRoutes);

// Serve uploads
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
    etag: true,
    immutable: process.env.NODE_ENV === "production",
  })
);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is alive" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  const exposeMessage = process.env.NODE_ENV !== "production";
  res.status(err.status || 500).json({
    message: exposeMessage
      ? err.message || "Internal Server Error"
      : "Internal Server Error",
  });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
