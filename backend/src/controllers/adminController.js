import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { logAdminAction } from "../utils/adminLog.js";
import AdminActionLog from "../models/AdminActionLog.js";
import ReturnRequest from "../models/ReturnRequest.js";
import OrderStatusAudit from "../models/OrderStatusAudit.js";
import {
  sendSellerRequestApprovedEmail,
  sendSellerRequestRejectedEmail,
  sendOrderDeliveredEmail,
} from "../services/email/emailService.js";
import {
  logOrderStatusChange,
  ALLOWED_ORDER_STATUSES,
} from "../utils/audit.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const clampInt = (value, min, max, fallback) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

// Permissions catalog for sub-admins
export const PERMISSIONS_CATALOG = [
  "users:read",
  "users:write",
  "sellers:read",
  "sellers:write",
  "products:read",
  "products:write",
  "products:delete",
  "orders:read",
  "orders:write",
  "orders:delete",
  "returns:read",
  "returns:write",
  "logs:read",
  "analytics:read",
  "emailTemplates:read",
  "emailTemplates:write",
  "media:read",
  "media:write",
  "coupons:read",
  "coupons:write",
];

// New: seller assistant permissions
export const SELLER_ASSISTANT_PERMISSIONS_CATALOG = [
  "seller:analytics:read",
  "seller:orders:read",
  "seller:orders:write",
  "seller:products:read",
  "seller:products:write",
  "seller:products:delete",
];

// ---------------- User Management ----------------

/** List all users */
export const listUsers = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 500, 200);
    const users = await User.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        "_id name email role status sellerRequest seller createdAt assistantFor permissions"
      )
      .lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get single user
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Get user details with order history and summary */
export const getUserDetailsWithOrders = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const orderLimit = clampInt(req.query.orderLimit, 1, 200, 50);
    const orders = await Order.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .limit(orderLimit)
      .populate("items.product", "title price")
      .lean();

    const summary = {
      ordersCount: orders.length,
      totalSpent: orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
      lastOrderAt: orders[0]?.createdAt || null,
    };

    res.json({ user, orders, summary });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Update user role */
export const updateUserRole = async (req, res) => {
  try {
    const { role, note } = req.body; // note is optional
    const ALLOWED_ROLES = [
      "user",
      "seller",
      "admin",
      "subadmin",
      "seller_assistant",
    ];
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const prevRole = user.role;
    if (prevRole === role) {
      return res.json({ message: "Role unchanged", user });
    }

    const before = {
      role: prevRole,
      sellerRequest: user.sellerRequest,
      seller: user.seller,
    };

    user.role = role;

    // If role is not seller, clear seller-related state
    if (role !== "seller") {
      user.seller = undefined;
      user.sellerRequest = "none";
    }
    if (role !== "seller_assistant") {
      user.assistantFor = undefined;
    }
    // Keep permissions for subadmin and seller_assistant; clear for others
    if (!["subadmin", "seller_assistant"].includes(user.role)) {
      user.permissions = [];
    }

    await user.save();

    // Log admin action
    await logAdminAction(req, {
      action: "user.role.update",
      entityType: "user",
      entityId: user._id,
      summary: `Role: ${prevRole} → ${role}`,
      before,
      after: {
        role: user.role,
        sellerRequest: user.sellerRequest,
        seller: user.seller,
      },
      note,
    });

    res.json({ message: "Role updated", user });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Block/Unblock user */
export const toggleUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const before = { status: user.status };
    user.status = status;
    await user.save();

    await logAdminAction(req, {
      action: "user.status.update",
      entityType: "user",
      entityId: user._id,
      summary: `Set user status to ${status}`,
      before,
      after: { status: user.status },
    });

    res.json({ message: `User ${status}`, user });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Permissions Management ----------------

/** Admin: permissions catalog */
export const getPermissionsCatalog = async (_req, res) => {
  res.json({
    permissions: PERMISSIONS_CATALOG,
    sellerAssistant: SELLER_ASSISTANT_PERMISSIONS_CATALOG,
  });
};

/** Admin: get a user's role/permissions/assistantFor */
export const getUserPermissions = async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select(
      "role permissions assistantFor seller"
    );
    if (!u) return res.status(404).json({ message: "User not found" });
    res.json({
      role: u.role,
      permissions: u.permissions || [],
      assistantFor: u.assistantFor || null,
      sellerApproved: !!u.seller?.approved,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Admin: set a user's permissions (subadmin or seller_assistant) */
export const updateUserPermissions = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only full admins can edit permissions" });
    }

    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res
        .status(400)
        .json({ message: "permissions must be an array of strings" });
    }

    const user = await User.findById(req.params.id).select("role permissions");
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role !== "subadmin" && user.role !== "seller_assistant") {
      return res
        .status(400)
        .json({ message: "Target user must be subadmin or seller_assistant" });
    }

    const allowedList =
      user.role === "subadmin"
        ? PERMISSIONS_CATALOG
        : SELLER_ASSISTANT_PERMISSIONS_CATALOG;

    const sanitized = Array.from(
      new Set(permissions.filter((p) => allowedList.includes(p)))
    );

    const before = { permissions: user.permissions || [] };
    user.permissions = sanitized;
    await user.save();

    await logAdminAction(req, {
      action: "user.permissions.update",
      entityType: "user",
      entityId: user._id,
      summary: `Updated permissions (${sanitized.length})`,
      before,
      after: { permissions: sanitized },
    });

    res.json({ message: "Permissions updated", permissions: user.permissions });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Admin: set/unset assistant link for seller assistants */
export const setAssistantFor = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only full admins can link assistants" });
    }

    const { sellerId } = req.body; // string or null to clear
    const assistant = await User.findById(req.params.id).select(
      "role assistantFor"
    );
    if (!assistant) return res.status(404).json({ message: "User not found" });

    if (assistant.role !== "seller_assistant") {
      return res
        .status(400)
        .json({ message: "Target user must be seller_assistant" });
    }

    let before = { assistantFor: assistant.assistantFor || null };

    if (sellerId) {
      const seller = await User.findById(sellerId).select("role seller");
      if (!seller || seller.role !== "seller" || !seller.seller?.approved) {
        return res
          .status(400)
          .json({ message: "Invalid sellerId or seller not approved" });
      }
      assistant.assistantFor = seller._id;
    } else {
      assistant.assistantFor = undefined;
    }

    await assistant.save();

    await logAdminAction(req, {
      action: sellerId ? "assistant.link" : "assistant.unlink",
      entityType: "user",
      entityId: assistant._id,
      summary: sellerId
        ? `Linked assistant to seller ${sellerId}`
        : "Unlinked assistant",
      before,
      after: { assistantFor: assistant.assistantFor || null },
    });

    res.json({
      message: "Assistant link updated",
      assistantFor: assistant.assistantFor || null,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Seller Requests ----------------

/** Approve/reject seller requests */
export const handleSellerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const before = {
      role: user.role,
      sellerRequest: user.sellerRequest,
      seller: user.seller,
    };

    if (action === "approve") {
      user.role = "seller";
      user.sellerRequest = "approved";
      user.seller = { approved: true, approvedAt: new Date() };
      await user.save();
      await sendSellerRequestApprovedEmail(user);
      await logAdminAction(req, {
        action: "seller.request.approve",
        entityType: "user",
        entityId: user._id,
        summary: "Approved seller request",
        before,
        after: { sellerRequest: user.sellerRequest, seller: user.seller },
      });
      return res.json({ message: "Seller request approved", user });
    } else if (action === "reject") {
      user.sellerRequest = "rejected";
      user.seller = { approved: false };
      await user.save();
      await sendSellerRequestRejectedEmail(user);
      await logAdminAction(req, {
        action: "seller.request.reject",
        entityType: "user",
        entityId: user._id,
        summary: "Rejected seller request",
        before,
        after: { sellerRequest: user.sellerRequest, seller: user.seller },
      });
      return res.json({ message: "Seller request rejected", user });
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Get seller application details */
export const getSellerApplication = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.sellerRequest === "none") {
      return res
        .status(400)
        .json({ message: "No seller request for this user" });
    }
    res.json({
      sellerRequest: user.sellerRequest,
      sellerApplication: user.sellerApplication,
      user,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** List all pending seller requests */
export const listSellerRequests = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 500, 200);
    const pending = await User.find({
      sellerRequest: "pending",
    })
      .select("_id name email role status sellerRequest seller createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Products Management ----------------

/** Admin: Get all products (active + blocked) */
export const listAllProducts = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 500, 250);
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        "_id title slug price discountPrice stock category status owner avgRating ratingsCount createdAt"
      )
      .populate("owner", "name email role")
      .lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Admin: Block or unblock product */
export const toggleProductStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "blocked"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const before = { status: product.status };
    product.status = status;
    await product.save();

    await logAdminAction(req, {
      action: "product.status.update",
      entityType: "product",
      entityId: product._id,
      summary: `Set product status to ${status}`,
      before,
      after: { status: product.status },
    });

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Admin: Delete product */
export const deleteProductAdmin = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    const before = { title: product.title, owner: product.owner };
    await product.deleteOne();

    await logAdminAction(req, {
      action: "product.delete",
      entityType: "product",
      entityId: req.params.id,
      summary: `Deleted product ${before.title || req.params.id}`,
      before,
      after: null,
    });

    res.json({ message: "Product deleted by admin" });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Orders Management ----------------

/**  List all orders (optional date filter)  */
export const listAllOrders = async (req, res) => {
  try {
    const { from, to } = req.query;
    const query = {};
    const limit = clampInt(req.query.limit, 1, 500, 200);
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        "_id user items subtotal tax shippingMethod shippingCost totalAmount address paymentMethod status createdAt updatedAt"
      )
      .populate("user", "name email")
      .populate("items.product", "title price category")
      .lean();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/**  Get Order by ID */
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email")
      .populate("items.product", "total price");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Get audit trail for an order (admin) */
export const getOrderAuditTrail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select("_id");
    if (!order) return res.status(404).json({ message: "Order not found" });

    const OrderStatusAudit = (await import("../models/OrderStatusAudit.js"))
      .default;
    const audit = await OrderStatusAudit.find({ order: order._id })
      .sort({ createdAt: 1 })
      .populate("changedBy", "name email role");

    res.json(audit);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Update order status (admin) */
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!ALLOWED_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    let order = await Order.findById(req.params.id)
      .populate("user")
      .populate("items.product");

    if (!order) return res.status(404).json({ message: "Order not found" });

    const from = order.status;
    if (from === status) {
      return res.json({ message: `Order already ${status}`, order });
    }

    order.status = status;
    await order.save();

    // Audit
    await logOrderStatusChange(req, {
      orderId: order._id,
      fromStatus: from,
      toStatus: status,
      context: "admin",
      note,
    });

    await logAdminAction(req, {
      action: "order.status.update",
      entityType: "order",
      entityId: order._id,
      summary: `Order status: ${from} → ${status}`,
      before: { status: from },
      after: { status },
      note,
    });

    if (status === "delivered") {
      try {
        await sendOrderDeliveredEmail(order.user, order);
      } catch (err) {
        console.error("Failed to send delivery email:", err.message);
      }
    }

    res.json({ message: `Order status updated to ${status}`, order });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Delete order */
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const before = { status: order.status, totalAmount: order.totalAmount };
    await order.deleteOne();

    await logAdminAction(req, {
      action: "order.delete",
      entityType: "order",
      entityId: req.params.id,
      summary: "Deleted order",
      before,
      after: null,
    });

    res.json({ message: "Order deleted" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Admin Analytics ----------------

/** Admin Overview (optional date range) */
export const getAdminOverview = async (req, res) => {
  try {
    const { from, to } = req.query;

    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    const totalUsers = await User.countDocuments(); // overall users
    const totalProducts = await Product.countDocuments(); // overall products

    const agg = await Order.aggregate(
      [
        Object.keys(match).length ? { $match: match } : null,
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            totalOrders: { $sum: 1 },
          },
        },
      ].filter(Boolean)
    );

    const totalRevenue = agg[0]?.totalRevenue || 0;
    const totalOrders = agg[0]?.totalOrders || 0;

    res.json({ totalUsers, totalOrders, totalProducts, totalRevenue });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Admin Sales Analytics (supports ?from=YYYY-MM-DD&to=YYYY-MM-DD or ?days=N) */
export const getAdminSales = async (req, res) => {
  try {
    const { from, to } = req.query;
    let match = {};

    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    } else {
      const days = parseInt(req.query.days) || 7;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      match = { createdAt: { $gte: fromDate } };
    }

    const sales = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(
      sales.map((s) => ({ date: s._id, orders: s.orders, revenue: s.revenue }))
    );
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Admin: List order audit logs with filters/pagination */
export const listOrderAuditLogs = async (req, res) => {
  try {
    const {
      page = "1",
      limit = "20",
      orderId,
      changedBy,
      toStatus,
      context,
      from,
      to,
    } = req.query;

    const p = Math.max(parseInt(page) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    const filter = {};

    // Filter by orderId
    if (orderId) {
      if (!isValidObjectId(orderId)) {
        return res.status(400).json({ message: "Invalid orderId" });
      }
      filter.order = orderId;
    }

    // Filter by toStatus
    const allowedStatuses = [
      "pending",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (toStatus) {
      if (!allowedStatuses.includes(toStatus)) {
        return res.status(400).json({ message: "Invalid toStatus" });
      }
      filter.toStatus = toStatus;
    }

    // Filter by context
    const allowedContexts = ["user", "seller", "admin", "system"];
    if (context) {
      if (!allowedContexts.includes(context)) {
        return res.status(400).json({ message: "Invalid context" });
      }
      filter.context = context;
    }

    // Date range
    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const start = new Date(from);
        if (!isNaN(start.getTime())) filter.createdAt.$gte = start;
      }
      if (to) {
        const end = new Date(to);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
    }

    // changedBy: email substring OR ObjectId
    if (changedBy) {
      if (isValidObjectId(changedBy)) {
        filter.changedBy = changedBy;
      } else if (typeof changedBy === "string" && changedBy.trim().length > 0) {
        const users = await User.find({
          email: { $regex: changedBy.trim(), $options: "i" },
        }).select("_id");
        const ids = users.map((u) => u._id);
        if (ids.length === 0) {
          return res.json({
            data: [],
            page: p,
            limit: l,
            total: 0,
            hasNext: false,
          });
        }
        filter.changedBy = { $in: ids };
      }
    }

    const total = await OrderStatusAudit.countDocuments(filter);
    const data = await OrderStatusAudit.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .populate("changedBy", "name email role")
      .lean();

    res.json({
      data,
      page: p,
      limit: l,
      total,
      hasNext: p * l < total,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Admin: List admin action logs with filters/pagination */
export const listAdminActionLogs = async (req, res) => {
  try {
    const {
      page = "1",
      limit = "20",
      action,
      entityType,
      entityId,
      changedBy,
      q,
      from,
      to,
    } = req.query;

    const p = Math.max(parseInt(page) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    const filter = {};
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = String(entityId);
    if (q) filter.summary = { $regex: String(q).trim(), $options: "i" };

    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const start = new Date(from);
        if (!isNaN(start.getTime())) filter.createdAt.$gte = start;
      }
      if (to) {
        const end = new Date(to);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
    }

    if (changedBy) {
      if (isValidObjectId(changedBy)) {
        filter.changedBy = changedBy;
      } else {
        const users = await User.find({
          email: { $regex: String(changedBy).trim(), $options: "i" },
        }).select("_id");
        const ids = users.map((u) => u._id);
        if (ids.length === 0) {
          return res.json({
            data: [],
            page: p,
            limit: l,
            total: 0,
            hasNext: false,
          });
        }
        filter.changedBy = { $in: ids };
      }
    }

    const total = await AdminActionLog.countDocuments(filter);
    const data = await AdminActionLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .populate("changedBy", "name email role")
      .lean();

    res.json({ data, page: p, limit: l, total, hasNext: p * l < total });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Get top products by sales (optional date range) */
export const getAdminTopProducts = async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    const top = await Order.aggregate(
      [
        Object.keys(match).length ? { $match: match } : null,
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            sold: { $sum: "$items.qty" },
            revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
          },
        },
        { $sort: { sold: -1 } },
        { $limit: 50 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        // Look up owner using a pipeline (more reliable)
        {
          $lookup: {
            from: "users",
            let: { ownerId: "$product.owner" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$ownerId"] } } },
              { $project: { _id: 1, name: 1, email: 1 } },
            ],
            as: "owner",
          },
        },
        { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            productId: "$product._id",
            product: "$product.title",
            sold: 1,
            revenue: 1,
            ownerId: "$owner._id",
            ownerName: "$owner.name",
            ownerEmail: "$owner.email",
          },
        },
      ].filter(Boolean)
    );

    res.json(top);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Admin: List return requests with filters/pagination */
export const listReturnRequests = async (req, res) => {
  try {
    const {
      page = "1",
      limit = "20",
      status,
      orderId,
      userId,
      from,
      to,
    } = req.query;

    const p = Math.max(parseInt(page) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    const filter = {};
    if (status) filter.status = status;
    if (orderId) filter.order = orderId;
    if (userId) filter.user = userId;
    if (from || to) {
      filter.requestedAt = {};
      if (from) {
        const start = new Date(from);
        if (!isNaN(start.getTime())) filter.requestedAt.$gte = start;
      }
      if (to) {
        const end = new Date(to);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          filter.requestedAt.$lte = end;
        }
      }
    }

    const total = await ReturnRequest.countDocuments(filter);
    const data = await ReturnRequest.find(filter)
      .sort({ requestedAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .populate("user", "name email")
      .populate("order", "_id totalAmount")
      .populate("items.product", "title")
      .lean();

    res.json({ data, page: p, limit: l, total, hasNext: p * l < total });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Admin: Update return request status */
export const updateReturnRequestStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status, note, refund } = req.body;

    const allowed = [
      "approved",
      "rejected",
      "received",
      "refunded",
      "cancelled",
    ];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const rr = await ReturnRequest.findById(id).populate("items.product");
    if (!rr)
      return res.status(404).json({ message: "Return request not found" });

    const prev = rr.status;

    // Simple transition guards
    if (prev === status) {
      return res.json({ message: "Status unchanged", request: rr });
    }
    if (prev === "rejected" || prev === "cancelled") {
      return res.status(400).json({ message: "Request already closed" });
    }
    if (status === "received" && prev !== "approved") {
      return res
        .status(400)
        .json({ message: "Can only mark received after approval" });
    }
    if (status === "refunded" && !["approved", "received"].includes(prev)) {
      return res
        .status(400)
        .json({ message: "Can only refund after approval/received" });
    }

    // Update timeline/status
    rr.status = status;
    if (status === "approved") rr.approvedAt = new Date();
    if (status === "rejected") rr.rejectedAt = new Date();
    if (status === "received") rr.receivedAt = new Date();
    if (status === "cancelled") rr.cancelledAt = new Date();

    // If received: restock each product by qty
    if (status === "received") {
      // restock in parallel
      await Promise.all(
        rr.items.map(async (it) => {
          const doc = await Product.findById(it.product._id);
          if (doc) {
            doc.stock = Math.max(
              0,
              Number(doc.stock || 0) + Number(it.qty || 0)
            );
            await doc.save();
          }
        })
      );
    }

    // If refunded: record refund info + timestamp
    if (status === "refunded") {
      rr.refund = {
        method: refund?.method || "manual",
        reference: refund?.reference || "",
        amount: refund?.amount != null ? Number(refund.amount) : undefined,
      };
      rr.refundedAt = new Date();
    }

    await rr.save();

    // Admin action log
    let summary = `Return ${prev} → ${status}`;
    if (status === "refunded" && rr.refund?.amount != null) {
      summary += ` (₹${rr.refund.amount})`;
    }

    await logAdminAction(req, {
      action: `return.${status}`,
      entityType: "order",
      entityId: rr.order,
      summary,
      before: { status: prev },
      after: { status: rr.status, refund: rr.refund || null },
      note,
    });

    res.json({ message: `Return ${status}`, request: rr });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

