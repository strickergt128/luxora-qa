import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { sendOrderDeliveredEmail } from "../services/email/emailService.js";
import {
  logOrderStatusChange,
  ALLOWED_ORDER_STATUSES,
} from "../utils/audit.js";

// GET /api/seller/products
export const listMyProducts = async (req, res) => {
  try {
    const products = await Product.find({ owner: req.sellerId }).sort({
      createdAt: -1,
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/seller/orders
export const listMyOrders = async (req, res) => {
  try {
    const { status, from, to } = req.query;

    // find products owned by this seller
    const myProducts = await Product.find({ owner: req.sellerId }).select(
      "_id"
    );
    const productIds = myProducts.map((p) => p._id);

    const query = { "items.product": { $in: productIds } };
    if (status) query.status = status;
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
      .populate("user", "name email")
      // IMPORTANT: include category here so the frontend can show correct categories
      .populate("items.product", "title price owner category");

    const shaped = orders
      .map((o) => {
        const items = o.items.filter(
          (it) =>
            it.product &&
            it.product.owner &&
            it.product.owner.toString() === req.sellerId.toString()
        );
        if (items.length === 0) return null;

        const sellerTotal = items.reduce(
          (sum, it) => sum + it.price * it.qty,
          0
        );

        return {
          _id: o._id,
          user: o.user,
          status: o.status,
          createdAt: o.createdAt,
          items: items.map((it) => ({
            product: {
              _id: it.product._id,
              title: it.product.title,
              // pass category through (string)
              category: it.product.category || "Other",
            },
            qty: it.qty,
            price: it.price,
          })),
          sellerTotal,
          totalAmount: o.totalAmount,
        };
      })
      .filter(Boolean);

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateMyOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const allowed = ALLOWED_ORDER_STATUSES;
    if (!allowed.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    let order = await Order.findById(req.params.id)
      .populate("items.product")
      .populate("user");
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Only if every item in order belongs to this seller
    const allMine = order.items.every(
      (it) =>
        it.product && it.product.owner?.toString() === req.sellerId.toString()
    );
    if (!allMine)
      return res
        .status(403)
        .json({ message: "Multi-seller order — admin only" });

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
      context: "seller",
      note,
    });

    // send delivered email if applicable
    if (status === "delivered") {
      try {
        await sendOrderDeliveredEmail(order.user, order);
      } catch {}
    }

    res.json({ message: `Order status updated to ${status}`, order });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyProductDetail = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      owner: req.sellerId,
    }).lean();
    if (!product) return res.status(404).json({ message: "Not found" });

    const ag = await Order.aggregate([
      { $match: { "items.product": product._id } },
      { $unwind: "$items" },
      { $match: { "items.product": product._id } },
      {
        $group: {
          _id: "$items.product",
          sold: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
          orders: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          _id: 0,
          sold: 1,
          revenue: 1,
          ordersCount: { $size: "$orders" },
        },
      },
    ]);
    const analytics = ag[0] || { sold: 0, revenue: 0, ordersCount: 0 };

    res.json({ product, analytics });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

