import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import AnalyticsEvent from "../models/AnalyticsEvent.js";

// ---------------- Public Tracking ----------------
// POST /api/analytics/track
export const trackEvent = async (req, res) => {
  try {
    const { event, sessionId, productId, page, meta } = req.body || {};
    const allowed = ["view", "cart", "checkout"];

    if (!sessionId || typeof sessionId !== "string" || sessionId.length < 8) {
      return res.status(400).json({ message: "Invalid sessionId" });
    }
    if (!allowed.includes(event)) {
      return res.status(400).json({ message: "Invalid event" });
    }

    const evt = new AnalyticsEvent({
      sessionId,
      userId: req.user?._id || undefined, // may be undefined for public endpoint
      event,
      productId,
      page,
      meta,
      ip: (
        (Array.isArray(req.headers["x-forwarded-for"])
          ? req.headers["x-forwarded-for"][0]
          : req.headers["x-forwarded-for"] || req.ip || ""
        )
          .toString()
          .split(",")[0]
          .trim() || "unknown"
      ).slice(0, 128),
      ua: (req.headers["user-agent"] || "").slice(0, 512),
      createdAt: new Date(),
    });
    await evt.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to track" });
  }
};

// ---------------- Admin Analytics: Conversion Funnel ----------------
// GET /api/admin/analytics/funnel?days=14 or ?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getAdminFunnel = async (req, res) => {
  try {
    const q = req.query || {};
    const days = parseInt(q.days) || 14;

    let fromDate, toDate;
    if (q.from && q.to) {
      fromDate = new Date(`${q.from}T00:00:00.000Z`);
      toDate = new Date(`${q.to}T23:59:59.999Z`);
    } else {
      const now = new Date();
      toDate = now;
      fromDate = new Date();
      fromDate.setDate(now.getDate() - (days - 1));
    }

    // Unique sessions per day per step
    const eventsAgg = await AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: fromDate, $lte: toDate },
          event: { $in: ["view", "cart", "checkout"] },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            event: "$event",
          },
          sessions: { $addToSet: "$sessionId" },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          event: "$_id.event",
          count: { $size: "$sessions" },
        },
      },
      { $sort: { date: 1 } },
    ]);

    // Totals (unique sessions across whole period)
    const totalsAgg = await AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: fromDate, $lte: toDate },
          event: { $in: ["view", "cart", "checkout"] },
        },
      },
      { $group: { _id: "$event", sessions: { $addToSet: "$sessionId" } } },
      { $project: { _id: 0, event: "$_id", count: { $size: "$sessions" } } },
    ]);

    const totals = { view: 0, cart: 0, checkout: 0, purchase: 0 };
    for (const t of totalsAgg) totals[t.event] = t.count;

    // Purchases from orders per day
    const ordersAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: "$_id", count: 1 } },
      { $sort: { date: 1 } },
    ]);
    totals.purchase = ordersAgg.reduce((s, r) => s + (r.count || 0), 0);

    // Merge daily
    const map = new Map();
    for (const e of eventsAgg) {
      if (!map.has(e.date))
        map.set(e.date, {
          date: e.date,
          view: 0,
          cart: 0,
          checkout: 0,
          purchase: 0,
        });
      map.get(e.date)[e.event] = e.count;
    }
    for (const o of ordersAgg) {
      if (!map.has(o.date))
        map.set(o.date, {
          date: o.date,
          view: 0,
          cart: 0,
          checkout: 0,
          purchase: 0,
        });
      map.get(o.date).purchase = o.count;
    }

    // Fill missing days (UTC)
    const out = [];
    const start = new Date(
      Date.UTC(
        fromDate.getUTCFullYear(),
        fromDate.getUTCMonth(),
        fromDate.getUTCDate()
      )
    );
    const end = new Date(
      Date.UTC(
        toDate.getUTCFullYear(),
        toDate.getUTCMonth(),
        toDate.getUTCDate()
      )
    );
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      out.push(
        map.get(key) || {
          date: key,
          view: 0,
          cart: 0,
          checkout: 0,
          purchase: 0,
        }
      );
    }

    res.json({ daily: out, totals });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch funnel" });
  }
};

// ---------------- Seller Analytics ----------------

// GET /api/seller/analytics/overview
export const getSellerOverview = async (req, res) => {
  try {
    const products = await Product.find({ owner: req.user._id });
    const productIds = products.map((p) => p._id);

    const totalProducts = products.length;
    const orders = await Order.find({ "items.product": { $in: productIds } });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    res.json({ totalProducts, totalOrders, totalRevenue });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/seller/analytics/sales?days=30
export const getSellerSales = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const products = await Product.find({ owner: req.user._id });
    const productIds = products.map((p) => p._id);

    const sales = await Order.aggregate([
      { $match: { createdAt: { $gte: fromDate } } },
      { $unwind: "$items" },
      { $match: { "items.product": { $in: productIds } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(
      sales.map((s) => ({
        date: s._id,
        orders: s.orders,
        revenue: s.revenue,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getSellerTopProducts = async (req, res) => {
  try {
    const products = await Product.find({ owner: req.user._id }).select("_id");
    const productIds = products.map((p) => p._id);

    const top = await Order.aggregate([
      { $unwind: "$items" },
      { $match: { "items.product": { $in: productIds } } },
      {
        $group: {
          _id: "$items.product",
          sold: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
        },
      },
      { $sort: { sold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          productId: "$product._id",
          product: "$product.title",
          sold: 1,
          revenue: 1,
        },
      },
    ]);

    res.json(top);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getSellerReviewsAnalytics = async (req, res) => {
  try {
    const products = await Product.find({ owner: req.user._id }).select("_id");
    const productIds = products.map((p) => p._id);

    // Overall rating and counts per product
    const grouped = await Review.aggregate([
      { $match: { product: { $in: productIds } } },
      {
        $group: {
          _id: "$product",
          avgRating: { $avg: "$rating" },
          reviews: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          productId: "$product._id",
          product: "$product.title",
          avgRating: 1,
          reviews: 1,
        },
      },
      { $sort: { reviews: -1 } },
    ]);

    const totalReviews = grouped.reduce((s, g) => s + g.reviews, 0);
    const overallAgg = await Review.aggregate([
      { $match: { product: { $in: productIds } } },
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]);
    const overallAvgRating = overallAgg[0]?.avg || 0;

    // Distribution per star
    const distAgg = await Review.aggregate([
      { $match: { product: { $in: productIds } } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const d of distAgg) {
      const k = String(d._id);
      distribution[k] = d.count;
    }

    res.json({
      totalReviews,
      overallAvgRating,
      distribution,
      topReviewed: grouped.slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

