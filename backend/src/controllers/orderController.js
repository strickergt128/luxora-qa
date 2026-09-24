import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Coupon from "../models/Coupon.js";
import OrderStatusAudit from "../models/OrderStatusAudit.js";
import ReturnRequest from "../models/ReturnRequest.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";
import {
  sendOrderConfirmationEmail,
  sendOrderDeliveredEmail,
} from "../services/email/emailService.js";
import {
  logOrderStatusChange,
  ALLOWED_ORDER_STATUSES,
} from "../utils/audit.js";

const RETURN_WINDOW_DAYS = parseInt(process.env.RETURN_WINDOW_DAYS || "7", 10);

function computeSubtotal(items) {
  return (items || []).reduce(
    (sum, i) =>
      sum + Number(i.priceAtAdd ?? i.product?.price ?? 0) * Number(i.qty ?? 0),
    0
  );
}
function nowInRange(c) {
  const now = new Date();
  if (c.startsAt && now < new Date(c.startsAt)) return false;
  if (c.expiresAt && now > new Date(c.expiresAt)) return false;
  return true;
}
function isItemEligible(item, coupon) {
  const hasCat =
    Array.isArray(coupon.allowedCategories) &&
    coupon.allowedCategories.length > 0;
  const hasBrand =
    Array.isArray(coupon.allowedBrands) && coupon.allowedBrands.length > 0;
  if (!hasCat && !hasBrand) return true;
  const cat = item.product?.category || "";
  const brand = item.product?.brand || "";
  const catOk = hasCat ? coupon.allowedCategories.includes(cat) : false;
  const brandOk = hasBrand ? coupon.allowedBrands.includes(brand) : false;
  return catOk || brandOk;
}
function computeEligibleSubtotal(items, coupon) {
  if (!coupon) return 0;
  const hasScope =
    (coupon.allowedCategories && coupon.allowedCategories.length) ||
    (coupon.allowedBrands && coupon.allowedBrands.length);
  if (!hasScope) return computeSubtotal(items);

  return (items || []).reduce((sum, i) => {
    if (!i || !i.product) return sum;
    if (!isItemEligible(i, coupon)) return sum;
    return (
      sum + Number(i.priceAtAdd ?? i.product?.price ?? 0) * Number(i.qty ?? 0)
    );
  }, 0);
}
function computeDiscount(coupon, items) {
  if (!coupon || !coupon.active) return 0;
  if (!nowInRange(coupon)) return 0;
  const eligibleSubtotal = computeEligibleSubtotal(items, coupon);
  if (eligibleSubtotal <= 0) return 0;

  let discount = 0;
  if (coupon.type === "percent") {
    discount = Math.round((eligibleSubtotal * Number(coupon.value || 0)) / 100);
    if (coupon.maxDiscount != null)
      discount = Math.min(discount, Number(coupon.maxDiscount));
  } else if (coupon.type === "fixed") {
    discount = Math.round(Number(coupon.value || 0));
  }
  discount = Math.max(0, Math.min(discount, eligibleSubtotal));
  return discount;
}

/** Place new order */
export const placeOrder = async (req, res) => {
  const runPlacement = async (session = null) => {
    const { address, shippingMethod } = req.body;
    if (!address) {
      const err = new Error("Address required");
      err.statusCode = 400;
      throw err;
    }

    const method = shippingMethod === "express" ? "express" : "standard";
    const shippingCost = method === "express" ? 99 : 0;
    const TAX_RATE = Number.parseFloat(process.env.TAX_RATE || "0.05"); // 5%
    const dbOpts = session ? { session } : undefined;

    const cartQuery = Cart.findOne({ user: req.user._id }).populate(
      "items.product"
    );
    if (session) cartQuery.session(session);
    const cart = await cartQuery;
    if (!cart || cart.items.length === 0) {
      const err = new Error("Cart is empty");
      err.statusCode = 400;
      throw err;
    }

    // Decrement stock atomically per item.
    for (const item of cart.items) {
      const updated = await Product.updateOne(
        { _id: item.product._id, stock: { $gte: Number(item.qty || 0) } },
        { $inc: { stock: -Number(item.qty || 0) } },
        dbOpts
      );
      if (updated.modifiedCount !== 1) {
        const err = new Error(`Not enough stock for ${item.product.title}`);
        err.statusCode = 400;
        throw err;
      }
    }

    const orderItems = cart.items.map((i) => {
      const price = Number(i.priceAtAdd ?? i.product.price ?? 0);
      const qty = Number(i.qty ?? 0);
      return { product: i.product._id, qty, price };
    });

    const subtotal = computeSubtotal(cart.items);

    // Coupon re-validation with scope
    let appliedCouponSnap = undefined;
    let discount = 0;

    if (cart.appliedCoupon?.code) {
      const couponQuery = Coupon.findOne({ code: cart.appliedCoupon.code });
      if (session) couponQuery.session(session);
      const coupon = await couponQuery;

      if (
        coupon &&
        coupon.active &&
        nowInRange(coupon) &&
        (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) &&
        (!coupon.minOrderValue || subtotal >= coupon.minOrderValue)
      ) {
        // per-user limit
        const entry = (coupon.usedBy || []).find(
          (u) => String(u.user) === String(req.user._id)
        );
        const perUserCount = entry?.count || 0;
        if (!coupon.perUserLimit || perUserCount < coupon.perUserLimit) {
          discount = computeDiscount(coupon, cart.items);
          if (discount > 0) {
            appliedCouponSnap = {
              code: coupon.code,
              type: coupon.type,
              value: coupon.value,
              discountAmount: discount,
            };
            // Update usage counters
            coupon.usedCount = (coupon.usedCount || 0) + 1;
            if (entry) {
              entry.count += 1;
            } else {
              coupon.usedBy.push({ user: req.user._id, count: 1 });
            }
            await coupon.save(dbOpts);
          }
        }
      }
    }

    const discountedSubtotal = Math.max(0, subtotal - discount);
    const tax = Math.round(discountedSubtotal * TAX_RATE);
    const total = discountedSubtotal + tax + shippingCost;

    const orderPayload = {
      user: req.user._id,
      items: orderItems,
      subtotal,
      tax,
      shippingMethod: method,
      shippingCost,
      totalAmount: total,
      address,
      paymentMethod: "COD",
      status: "pending",
      appliedCoupon: appliedCouponSnap,
    };

    let order;
    if (session) {
      const created = await Order.create([orderPayload], { session });
      order = created[0];
    } else {
      order = await Order.create(orderPayload);
    }

    // Clear cart and coupon
    cart.items = [];
    cart.appliedCoupon = undefined;
    await cart.save(dbOpts);

    return order;
  };

  const session = await mongoose.startSession();
  try {
    let order;
    let orderForEmail;
    try {
      await session.withTransaction(async () => {
        order = await runPlacement(session);
      });
    } catch (txErr) {
      const msg = String(txErr?.message || "");
      const txUnsupported =
        msg.includes("Transaction numbers are only allowed on a replica set") ||
        msg.includes("Transaction support") ||
        msg.includes("replica set");

      if (!txUnsupported) throw txErr;

      // Fallback for standalone MongoDB setups.
      order = await runPlacement(null);
    }

    // Audit: initial status
    await logOrderStatusChange(req, {
      orderId: order._id,
      fromStatus: null,
      toStatus: "pending",
      context: "user",
      note: "Order placed",
    });

    // Repopulate for returning in response and for email template
    orderForEmail = await Order.findById(order._id).populate("items.product");

    res.status(201).json(orderForEmail);

    setImmediate(async () => {
      try {
        await sendOrderConfirmationEmail(req.user, orderForEmail);
      } catch (err) {
        console.error(
          "[email] order confirmation failed:",
          err?.message || err
        );
      }
    });
  } catch (err) {
    const statusCode = Number(err?.statusCode || 0);
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({ message: err.message });
    }

    if (err?.message === "Address required")
      return res.status(400).json({ message: "Address required" });
    if (err?.message === "Cart is empty")
      return res.status(400).json({ message: "Cart is empty" });
    if (String(err?.message || "").startsWith("Not enough stock for "))
      return res.status(400).json({ message: err.message });

    console.error("[order] placeOrder failed:", err?.message || err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    await session.endSession();
  }
};

/** Get my orders */
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).populate(
      "items.product"
    );
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Get single order (only owner) */
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product");
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.user.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Forbidden" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Get audit trail for my order (owner-only) */
export const getOrderAuditForUser = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select("user");
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.user.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Forbidden" });

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

/** Update order status (admin only via /api/orders/:id/status) */
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!ALLOWED_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    let order = await Order.findById(req.params.id).populate("user");
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

    // repopulate for email template
    order = await Order.findById(order._id)
      .populate("user")
      .populate("items.product");

    if (status === "delivered") {
      try {
        await sendOrderDeliveredEmail(order.user, order);
      } catch (err) {
        console.error("Failed to send delivery email:", err.message);
      }
    }

    res.json({ message: `Order status updated to ${status}`, order });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Helper: get deliveredAt from audit or fallback to order.createdAt */
async function getDeliveredAt(orderId, orderCreatedAt) {
  const audit = await OrderStatusAudit.findOne({
    order: orderId,
    toStatus: "delivered",
  })
    .sort({ createdAt: -1 })
    .lean();

  return audit?.createdAt || orderCreatedAt;
}

/** Helper: compute available qty per product for returns */
async function computeAvailableQuantities(order) {
  const totals = new Map();
  for (const it of order.items) {
    const pid = String(it.product);
    totals.set(pid, (totals.get(pid) || 0) + Number(it.qty));
  }

  const activeStatuses = ["requested", "approved", "received", "refunded"];
  const existing = await ReturnRequest.find({
    order: order._id,
    status: { $in: activeStatuses },
  }).lean();

  const used = new Map();
  for (const rr of existing) {
    for (const it of rr.items || []) {
      const pid = String(it.product);
      used.set(pid, (used.get(pid) || 0) + Number(it.qty));
    }
  }

  const available = new Map();
  for (const [pid, qty] of totals.entries()) {
    const u = used.get(pid) || 0;
    available.set(pid, Math.max(0, qty - u));
  }
  return available;
}

/** POST /api/orders/:id/returns (user) */
export const createReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { items, reason, note } = req.body;

    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (String(order.user) !== String(req.user._id))
      return res.status(403).json({ message: "Forbidden" });

    // Ensure delivered and within window
    const deliveredAt = await getDeliveredAt(order._id, order.createdAt);
    if (!deliveredAt) {
      return res.status(400).json({ message: "Order not delivered yet" });
    }
    const cutoff = new Date(deliveredAt);
    cutoff.setDate(cutoff.getDate() + RETURN_WINDOW_DAYS);
    if (Date.now() > cutoff.getTime()) {
      return res.status(400).json({ message: "Return window expired" });
    }

    // Validate items array
    let reqItems;
    try {
      reqItems = Array.isArray(items) ? items : JSON.parse(items || "[]");
    } catch {
      reqItems = [];
    }
    if (!Array.isArray(reqItems) || reqItems.length === 0) {
      return res.status(400).json({ message: "No items provided" });
    }

    // Map of order items for price lookup
    const orderPriceMap = new Map();
    for (const it of order.items) {
      orderPriceMap.set(String(it.product), Number(it.price));
    }

    const available = await computeAvailableQuantities(order);
    const finalItems = [];

    for (const it of reqItems) {
      const pid = String(it.product || it.productId);
      const qty = Math.max(0, parseInt(it.qty, 10) || 0);

      if (!pid || qty <= 0) {
        return res.status(400).json({ message: "Invalid item payload" });
      }
      if (!orderPriceMap.has(pid)) {
        return res.status(400).json({ message: "Product not in order" });
      }
      const avail = available.get(pid) || 0;
      if (qty > avail) {
        return res
          .status(400)
          .json({
            message: "Requested quantity exceeds available returnable quantity",
          });
      }

      finalItems.push({
        product: pid,
        qty,
        price: orderPriceMap.get(pid),
      });
    }

    if (finalItems.length === 0) {
      return res.status(400).json({ message: "No valid items to return" });
    }

    // Attachment (single)
    const attachments = [];
    if (req.file) {
      const url =
        process.env.STORAGE_MODE === "cloud"
          ? req.file.path
          : `/uploads/${req.file.filename}`;
      attachments.push({
        url,
        name: req.file.originalname || req.file.filename,
      });
    }

    const rr = await ReturnRequest.create({
      order: order._id,
      user: req.user._id,
      items: finalItems,
      reason: reason || "",
      note: note || "",
      attachments,
      status: "requested",
      requestedAt: new Date(),
    });

    res.status(201).json(rr);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/** GET /api/orders/:id/returns (user) */
export const getMyReturnRequests = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).select("user").lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (String(order.user) !== String(req.user._id))
      return res.status(403).json({ message: "Forbidden" });

    const list = await ReturnRequest.find({
      order: orderId,
      user: req.user._id,
    })
      .sort({ requestedAt: -1 })
      .populate("items.product", "title price")
      .lean();

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

