import express from "express";
import multer from "multer";
import { protect } from "../middleware/authMiddleware.js";
import {
  withSellerScope,
  requireSellerPermissions,
} from "../middleware/roleMiddleware.js";
import {
  listMyProducts,
  listMyOrders,
  updateMyOrderStatus,
  getMyProductDetail,
} from "../controllers/sellerController.js";
import {
  getSellerOverview,
  getSellerSales,
  getSellerTopProducts,
  getSellerReviewsAnalytics,
} from "../controllers/analyticsController.js";
import {
  downloadTemplate as bulkTemplate,
  importBulk as bulkImport,
} from "../controllers/sellerBulkProductController.js";

const router = express.Router();

// Require authentication and approved seller/assistant (admin allowed with sellerId)
router.use(protect, withSellerScope({ allowAdmin: true }));

// Products
router.get(
  "/products",
  requireSellerPermissions("seller:products:read"),
  listMyProducts
);
router.get(
  "/products/:id",
  requireSellerPermissions("seller:products:read"),
  getMyProductDetail
);

// Bulk products (seller-only flow)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file (ZIP)
    files: 2,
  },
});
router.get(
  "/bulk-products/template",
  requireSellerPermissions("seller:products:write"),
  bulkTemplate
);
router.post(
  "/bulk-products/import",
  requireSellerPermissions("seller:products:write"),
  upload.fields([
    { name: "csv", maxCount: 1 },
    { name: "media", maxCount: 1 }, // optional ZIP with images/videos
  ]),
  bulkImport
);

// Orders
router.get(
  "/orders",
  requireSellerPermissions("seller:orders:read"),
  listMyOrders
);
router.patch(
  "/orders/:id/status",
  requireSellerPermissions("seller:orders:write"),
  updateMyOrderStatus
);

// Analytics
router.get(
  "/analytics/overview",
  requireSellerPermissions("seller:analytics:read"),
  getSellerOverview
);
router.get(
  "/analytics/sales",
  requireSellerPermissions("seller:analytics:read"),
  getSellerSales
); // supports ?days
router.get(
  "/analytics/top-products",
  requireSellerPermissions("seller:analytics:read"),
  getSellerTopProducts
);
router.get(
  "/analytics/reviews",
  requireSellerPermissions("seller:analytics:read"),
  getSellerReviewsAnalytics
);

export default router;
