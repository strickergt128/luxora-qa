import Product from "../models/Product.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import AnalyticsEvent from "../models/AnalyticsEvent.js"; // ✅ log searches for trending

const escapeRegex = (input = "") =>
  String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TRENDING_CACHE_TTL_MS = 60 * 1000;
const trendingCache = new Map(); // key: days -> { value, expiresAt }

// Unified global search API
export const globalSearch = async (req, res) => {
  const q = String(req.query.q || "")
    .trim()
    .slice(0, 80);
  if (!q) return res.json({ products: [], categories: [], sellers: [] });

  try {
    const regex = new RegExp(escapeRegex(q), "i");

    // 🔍 Find matching categories too (Product.category stores category name)
    const matchedCategories = await Category.find({ name: regex })
      .limit(5)
      .select("name")
      .lean();
    const categoryNames = matchedCategories.map((c) => c.name);

    // 🔍 Find products by title / tags / brand / seo / categories
    const products = await Product.find({
      status: "active",
      $or: [
        { title: regex },
        { tags: regex },
        { brand: regex },
        { "seo.title": regex },
        { "seo.description": regex },
        { category: { $in: categoryNames } }, // ✅ category match by name
      ],
    })
      .limit(10)
      .select("title images price tags category avgRating ratingsCount")
      .lean();

    const categories = matchedCategories.map((c) => ({
      name: c.name,
      _id: c._id,
    }));

    const sellers = await User.find({ role: "seller", name: regex })
      .limit(5)
      .select("name email")
      .lean();

    // log analytics
    await AnalyticsEvent.create({
      sessionId: req.cookies?.rt || req.ip,
      userId: req.user?._id,
      event: "search",
      meta: { query: q },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    res.json({ products, categories, sellers });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Trending searches API
export const trendingSearches = async (req, res) => {
  try {
    const daysRaw = Number.parseInt(String(req.query.days || "7"), 10);
    const days = Number.isFinite(daysRaw)
      ? Math.min(30, Math.max(1, daysRaw))
      : 7;

    const cached = trendingCache.get(days);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.value);
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const agg = await AnalyticsEvent.aggregate([
      { $match: { event: "search", createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$meta.query", // ✅ group by the query we logged in meta
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    const value = agg.map((a) => a._id);
    trendingCache.set(days, {
      value,
      expiresAt: Date.now() + TRENDING_CACHE_TTL_MS,
    });

    res.json(value);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

