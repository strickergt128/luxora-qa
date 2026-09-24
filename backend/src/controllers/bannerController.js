import Banner from "../models/Banner.js";
import AnalyticsEvent from "../models/AnalyticsEvent.js";
import { logAdminAction } from "../utils/adminLog.js";

// Helper to normalize slugs (if passed)
const norm = (s) =>
  typeof s === "string"
    ? s.toString().trim().toLowerCase()
    : s === undefined
    ? undefined
    : String(s).toLowerCase().trim();

const clientIp = (req) =>
  (Array.isArray(req.headers["x-forwarded-for"])
    ? req.headers["x-forwarded-for"][0]
    : req.headers["x-forwarded-for"] || req.ip || ""
  )
    .toString()
    .split(",")[0]
    .trim() || "unknown";

const sessionOf = (req) => {
  const ua = (req.get("user-agent") || "").slice(0, 128);
  return (
    req.cookies?.sid || req.cookies?.rt || `${clientIp(req)}|${ua.slice(0, 32)}`
  );
};

const ymdUTC = (d = new Date()) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// -------- Public --------
export const getActiveBanner = async (req, res) => {
  try {
    const placement = String(req.query.placement || "").trim();
    const categorySlug = req.query.categorySlug
      ? norm(req.query.categorySlug)
      : undefined;

    if (!placement) {
      return res.status(400).json({ message: "placement required" });
    }

    const now = new Date();

    const match = {
      placement,
      active: true,
      $and: [
        {
          $or: [
            { startAt: { $exists: false } },
            { startAt: null },
            { startAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { endAt: { $exists: false } },
            { endAt: null },
            { endAt: { $gte: now } },
          ],
        },
      ],
    };

    if (placement === "category_header" && categorySlug) {
      match.categorySlug = categorySlug;
    }

    const banner = await Banner.findOne(match)
      .sort({ priority: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    res.json({ banner: banner || null });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const recordImpression = async (req, res) => {
  try {
    const { id } = req.params;
    const b = await Banner.findById(id).select("_id placement").lean();
    if (!b) return res.json({ ok: true });

    const sid = sessionOf(req);
    const ymd = ymdUTC();

    const exists = await AnalyticsEvent.findOne({
      sessionId: sid,
      event: "banner_impression",
      ymd,
      "meta.bannerId": String(b._id),
    }).lean();

    if (!exists) {
      await Banner.updateOne({ _id: b._id }, { $inc: { impressions: 1 } });
      try {
        await AnalyticsEvent.create({
          sessionId: sid,
          userId: req.user?._id,
          event: "banner_impression",
          meta: { bannerId: String(b._id), placement: b.placement },
          ip: clientIp(req),
          ua: req.get("user-agent"),
          createdAt: new Date(),
        });
      } catch {}
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const recordClick = async (req, res) => {
  try {
    const { id } = req.params;
    const b = await Banner.findById(id).select("_id placement").lean();
    if (!b) return res.json({ ok: true });

    const sid = sessionOf(req);
    const ymd = ymdUTC();

    const exists = await AnalyticsEvent.findOne({
      sessionId: sid,
      event: "banner_click",
      ymd,
      "meta.bannerId": String(b._id),
    }).lean();

    if (!exists) {
      await Banner.updateOne({ _id: b._id }, { $inc: { clicks: 1 } });
      try {
        await AnalyticsEvent.create({
          sessionId: sid,
          userId: req.user?._id,
          event: "banner_click",
          meta: { bannerId: String(b._id), placement: b.placement },
          ip: clientIp(req),
          ua: req.get("user-agent"),
          createdAt: new Date(),
        });
      } catch {}
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// -------- Admin --------
export const listBanners = async (req, res) => {
  try {
    const q = {};
    if (req.query.placement) q.placement = String(req.query.placement);
    const items = await Banner.find(q).sort({ updatedAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createBanner = async (req, res) => {
  try {
    const {
      title,
      altText,
      imageUrl,
      linkUrl,
      placement,
      categorySlug,
      active = true,
      startAt,
      endAt,
      priority = 0,
      // brand-safe split fields
      layout,
      imagePosition,
      imageFit,
      headline,
      subheadline,
      ctaLabel,
    } = req.body;

    if (!imageUrl || !placement) {
      return res
        .status(400)
        .json({ message: "imageUrl and placement required" });
    }

    const banner = await Banner.create({
      title,
      altText,
      imageUrl,
      linkUrl,
      placement,
      categorySlug:
        placement === "category_header" ? norm(categorySlug || "") : undefined,
      active: Boolean(active),
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      priority: Number(priority) || 0,
      layout: layout || "image_full",
      imagePosition: imagePosition || "right",
      imageFit: imageFit || "contain",
      headline,
      subheadline,
      ctaLabel,
    });

    try {
      await logAdminAction(req, {
        action: "banner_create",
        entityType: "banner",
        entityId: String(banner._id),
        summary: `Create banner ${banner.placement}${
          banner.categorySlug ? `:${banner.categorySlug}` : ""
        }`,
        before: null,
        after: banner,
      });
    } catch {}

    res.status(201).json(banner);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const updateBanner = async (req, res) => {
  try {
    const before = await Banner.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ message: "Not found" });

    const {
      title,
      altText,
      imageUrl,
      linkUrl,
      placement,
      categorySlug,
      active,
      startAt,
      endAt,
      priority,
      layout,
      imagePosition,
      imageFit,
      headline,
      subheadline,
      ctaLabel,
    } = req.body;

    const patch = {};
    if (title !== undefined) patch.title = title;
    if (altText !== undefined) patch.altText = altText;
    if (imageUrl !== undefined) patch.imageUrl = imageUrl;
    if (linkUrl !== undefined) patch.linkUrl = linkUrl;
    if (placement !== undefined) patch.placement = placement;
    if (categorySlug !== undefined)
      patch.categorySlug =
        placement === "category_header" ? norm(categorySlug || "") : undefined;
    if (active !== undefined) patch.active = Boolean(active);
    if (startAt !== undefined)
      patch.startAt = startAt ? new Date(startAt) : undefined;
    if (endAt !== undefined) patch.endAt = endAt ? new Date(endAt) : undefined;
    if (priority !== undefined) patch.priority = Number(priority) || 0;
    if (layout !== undefined) patch.layout = layout;
    if (imagePosition !== undefined) patch.imagePosition = imagePosition;
    if (imageFit !== undefined) patch.imageFit = imageFit;
    if (headline !== undefined) patch.headline = headline;
    if (subheadline !== undefined) patch.subheadline = subheadline;
    if (ctaLabel !== undefined) patch.ctaLabel = ctaLabel;

    const banner = await Banner.findByIdAndUpdate(req.params.id, patch, {
      new: true,
    });
    if (!banner) return res.status(404).json({ message: "Not found" });

    try {
      await logAdminAction(req, {
        action: "banner_update",
        entityType: "banner",
        entityId: String(banner._id),
        summary: `Update banner ${banner.placement}${
          banner.categorySlug ? `:${banner.categorySlug}` : ""
        }`,
        before,
        after: banner,
      });
    } catch {}

    res.json(banner);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    const before = await Banner.findById(req.params.id).lean();
    const doc = await Banner.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    try {
      await logAdminAction(req, {
        action: "banner_delete",
        entityType: "banner",
        entityId: String(req.params.id),
        summary: `Delete banner ${before?.placement || ""}${
          before?.categorySlug ? `:${before.categorySlug}` : ""
        }`,
        before,
        after: null,
      });
    } catch {}

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

