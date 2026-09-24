import SponsoredPlacement from "../models/SponsoredPlacement.js";
import Product from "../models/Product.js";
import AnalyticsEvent from "../models/AnalyticsEvent.js";
import { logAdminAction } from "../utils/adminLog.js";

const norm = (s) =>
  typeof s === "string"
    ? s.toString().trim().toLowerCase()
    : s === undefined
    ? undefined
    : String(s).toLowerCase().trim();

const noneTargetCondition = {
  $or: [
    { targetCategorySlug: { $exists: false } },
    { targetCategorySlug: null },
    { targetCategorySlug: "" },
  ],
};

// -------- Admin --------
export const listPlacements = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = String(req.query.status);
    const items = await SponsoredPlacement.find(q)
      .sort({ updatedAt: -1 })
      .populate({
        path: "product",
        select: "title brand price stock images status",
      })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createPlacement = async (req, res) => {
  try {
    const {
      productId,
      startAt,
      endAt,
      priority = 0,
      status = "approved",
      notes,
      targetCategorySlug,
    } = req.body;

    if (!productId)
      return res.status(400).json({ message: "productId required" });

    // Ensure product exists (and fetch owner)
    const prod = await Product.findById(productId).select("owner");
    if (!prod) return res.status(400).json({ message: "Invalid productId" });

    const normalizedTarget = targetCategorySlug
      ? norm(targetCategorySlug)
      : undefined;

    // Conflict: same priority in the same target scope (category or 'none')
    const conflict = await SponsoredPlacement.findOne({
      priority: Number(priority) || 0,
      status: { $in: ["approved", "pending", "paused"] },
      ...(normalizedTarget
        ? { targetCategorySlug: normalizedTarget }
        : noneTargetCondition),
    }).lean();

    if (conflict) {
      return res.status(409).json({
        message:
          "A sponsored placement already uses this priority for this target (category or none). Choose a different priority or update the existing placement.",
      });
    }

    const doc = await SponsoredPlacement.create({
      product: productId,
      seller: prod.owner,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      priority: Number(priority) || 0,
      status,
      notes,
      targetCategorySlug: normalizedTarget,
      createdBy: req.user?._id,
    });

    try {
      await logAdminAction(req, {
        action: "sponsored_create",
        entityType: "sponsored",
        entityId: String(doc._id),
        summary: `Create sponsored for product ${doc.product}${
          doc.targetCategorySlug ? ` target:${doc.targetCategorySlug}` : ""
        }`,
        before: null,
        after: doc,
      });
    } catch {}

    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const updatePlacement = async (req, res) => {
  try {
    const before = await SponsoredPlacement.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ message: "Not found" });

    const { status, startAt, endAt, priority, notes, targetCategorySlug } =
      req.body;
    const patch = {};
    if (status !== undefined) patch.status = status;
    if (startAt !== undefined)
      patch.startAt = startAt ? new Date(startAt) : undefined;
    if (endAt !== undefined) patch.endAt = endAt ? new Date(endAt) : undefined;
    if (priority !== undefined) patch.priority = Number(priority) || 0;
    if (notes !== undefined) patch.notes = notes;

    const normalizedTarget =
      targetCategorySlug !== undefined
        ? targetCategorySlug
          ? norm(targetCategorySlug)
          : undefined
        : before.targetCategorySlug;

    if (targetCategorySlug !== undefined)
      patch.targetCategorySlug = normalizedTarget;

    // If priority or target changed, check conflicts
    const checkPriority =
      priority !== undefined ? Number(priority) || 0 : before.priority;
    const targetToCheck =
      targetCategorySlug !== undefined
        ? normalizedTarget
        : before.targetCategorySlug;

    const conflict = await SponsoredPlacement.findOne({
      _id: { $ne: before._id },
      priority: checkPriority,
      status: { $in: ["approved", "pending", "paused"] },
      ...(targetToCheck
        ? { targetCategorySlug: targetToCheck }
        : noneTargetCondition),
    }).lean();

    if (conflict) {
      return res.status(409).json({
        message:
          "A sponsored placement already uses this priority for this target (category or none). Choose a different priority.",
      });
    }

    const doc = await SponsoredPlacement.findByIdAndUpdate(
      req.params.id,
      patch,
      {
        new: true,
      }
    );
    if (!doc) return res.status(404).json({ message: "Not found" });

    try {
      await logAdminAction(req, {
        action: "sponsored_update",
        entityType: "sponsored",
        entityId: String(doc._id),
        summary: `Update sponsored ${doc.product} -> ${doc.status}`,
        before,
        after: doc,
      });
    } catch {}

    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const deletePlacement = async (req, res) => {
  try {
    const before = await SponsoredPlacement.findById(req.params.id).lean();
    const doc = await SponsoredPlacement.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    try {
      await logAdminAction(req, {
        action: "sponsored_delete",
        entityType: "sponsored",
        entityId: String(req.params.id),
        summary: `Delete sponsored ${before?.product || ""}`,
        before,
        after: null,
      });
    } catch {}

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// -------- Public (optional) --------
export const sponsoredImpression = async (req, res) => {
  try {
    const { id } = req.params;
    await SponsoredPlacement.findByIdAndUpdate(id, {
      $inc: { impressions: 1 },
    });
    try {
      await AnalyticsEvent.create({
        sessionId: req.cookies?.rt || req.ip,
        userId: req.user?._id,
        event: "sponsored_impression",
        meta: { placementId: id },
        ip: req.ip,
        ua: req.get("user-agent"),
      });
    } catch {}
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sponsoredClick = async (req, res) => {
  try {
    const { id } = req.params;
    await SponsoredPlacement.findByIdAndUpdate(id, { $inc: { clicks: 1 } });
    try {
      await AnalyticsEvent.create({
        sessionId: req.cookies?.rt || req.ip,
        userId: req.user?._id,
        event: "sponsored_click",
        meta: { placementId: id },
        ip: req.ip,
        ua: req.get("user-agent"),
      });
    } catch {}
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

