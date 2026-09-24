import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  requireAdminMFA,
  requirePermissions,
} from "../middleware/roleMiddleware.js";
import {
  listUsers,
  updateUserRole,
  toggleUserStatus,
  getUserById,
  listSellerRequests,
  handleSellerRequest,
  listAllProducts,
  toggleProductStatus,
  deleteProductAdmin,
  listAllOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  getAdminOverview,
  getAdminSales,
  getAdminTopProducts,
  getSellerApplication,
  getUserDetailsWithOrders,
  getOrderAuditTrail,
  listOrderAuditLogs,
  listAdminActionLogs,
  listReturnRequests,
  updateReturnRequestStatus,
  // NEW:
  getPermissionsCatalog,
  getUserPermissions,
  updateUserPermissions,
  setAssistantFor,
} from "../controllers/adminController.js";
import { getAdminFunnel } from "../controllers/analyticsController.js";

const router = express.Router();

router.use(protect, requireAdminMFA);

// Permissions management (admin only)
router.get(
  "/permissions/catalog",
  requirePermissions("users:write"),
  getPermissionsCatalog
);
router.get(
  "/users/:id/permissions",
  requirePermissions("users:read"),
  getUserPermissions
);
router.patch(
  "/users/:id/permissions",
  requirePermissions("users:write"),
  updateUserPermissions
);
router.patch(
  "/users/:id/assistant",
  requirePermissions("users:write"),
  setAssistantFor
);

// USERS
router.get("/users", requirePermissions("users:read"), listUsers);
router.get("/users/:id", requirePermissions("users:read"), getUserById);
router.patch(
  "/users/:id/role",
  requirePermissions("users:write"),
  updateUserRole
);
router.patch(
  "/users/:id/status",
  requirePermissions("users:write"),
  toggleUserStatus
);
router.get(
  "/users/:id/details",
  requirePermissions("users:read"),
  getUserDetailsWithOrders
);

// SELLER REQUESTS
router.get(
  "/seller-requests",
  requirePermissions("sellers:read"),
  listSellerRequests
);
router.patch(
  "/seller-requests/:id",
  requirePermissions("sellers:write"),
  handleSellerRequest
);
router.get(
  "/seller-requests/:id/details",
  requirePermissions("sellers:read"),
  getSellerApplication
);

// PRODUCTS
router.get("/products", requirePermissions("products:read"), listAllProducts);
router.patch(
  "/products/:id/status",
  requirePermissions("products:write"),
  toggleProductStatus
);
router.delete(
  "/products/:id",
  requirePermissions("products:delete"),
  deleteProductAdmin
);

// ORDERS
router.get("/orders", requirePermissions("orders:read"), listAllOrders);
router.get("/orders/:id", requirePermissions("orders:read"), getOrderById);
router.get(
  "/orders/:id/audit",
  requirePermissions("logs:read"),
  getOrderAuditTrail
);
router.patch(
  "/orders/:id/status",
  requirePermissions("orders:write"),
  updateOrderStatus
);
router.delete("/orders/:id", requirePermissions("orders:delete"), deleteOrder);

// LOGS
router.get("/logs/orders", requirePermissions("logs:read"), listOrderAuditLogs);
router.get(
  "/logs/actions",
  requirePermissions("logs:read"),
  listAdminActionLogs
);

// RETURNS
router.get("/returns", requirePermissions("returns:read"), listReturnRequests);
router.patch(
  "/returns/:id/status",
  requirePermissions("returns:write"),
  updateReturnRequestStatus
);

// ANALYTICS
router.get(
  "/analytics/overview",
  requirePermissions("analytics:read"),
  getAdminOverview
);
router.get(
  "/analytics/sales",
  requirePermissions("analytics:read"),
  getAdminSales
);
router.get(
  "/analytics/top-products",
  requirePermissions("analytics:read"),
  getAdminTopProducts
);
router.get(
  "/analytics/funnel",
  requirePermissions("analytics:read"),
  getAdminFunnel
);

export default router;
