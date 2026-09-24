import Coupon from "../models/Coupon.js";
import { logAdminAction } from "../utils/adminLog.js";

function normArray(arr) {
  if (!arr) return undefined;
  const a = Array.isArray(arr) ? arr : String(arr).split(",");
  return a.map((s) => String(s).trim()).filter(Boolean);
}

// Create
export const createCoupon = async (req, res) => {
  try {
    const payload = req.body || {};
    payload.code = String(payload.code || "")
      .toUpperCase()
      .trim();
    payload.allowedCategories = normArray(payload.allowedCategories);
    payload.allowedBrands = normArray(payload.allowedBrands);
    const coupon = await Coupon.create(payload);
    await logAdminAction(req, {
      action: "coupon.create",
      entityType: "coupon",
      entityId: coupon._id,
      summary: `Created coupon ${coupon.code}`,
      before: null,
      after: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        active: coupon.active,
      },
    });
    res.status(201).json(coupon);
  } catch (err) {
    if (String(err?.code) === "11000") {
      return res.status(400).json({ message: "Code already exists" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

// List
export const listCoupons = async (req, res) => {
  try {
    const list = await Coupon.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get one
export const getCoupon = async (req, res) => {
  try {
    const c = await Coupon.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Not found" });
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update
export const updateCoupon = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.code) payload.code = String(payload.code).toUpperCase().trim();
    if (payload.allowedCategories !== undefined)
      payload.allowedCategories = normArray(payload.allowedCategories);
    if (payload.allowedBrands !== undefined)
      payload.allowedBrands = normArray(payload.allowedBrands);
    const prev = await Coupon.findById(req.params.id).lean();
    const c = await Coupon.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    });
    if (!c) return res.status(404).json({ message: "Not found" });
    await logAdminAction(req, {
      action: "coupon.update",
      entityType: "coupon",
      entityId: c._id,
      summary: `Updated coupon ${c.code}`,
      before: prev
        ? {
            code: prev.code,
            type: prev.type,
            value: prev.value,
            active: prev.active,
          }
        : null,
      after: { code: c.code, type: c.type, value: c.value, active: c.active },
    });
    res.json(c);
  } catch (err) {
    if (String(err?.code) === "11000") {
      return res.status(400).json({ message: "Code already exists" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete
export const deleteCoupon = async (req, res) => {
  try {
    const prev = await Coupon.findById(req.params.id).lean();
    const c = await Coupon.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ message: "Not found" });
    await logAdminAction(req, {
      action: "coupon.delete",
      entityType: "coupon",
      entityId: String(req.params.id),
      summary: `Deleted coupon ${prev?.code || req.params.id}`,
      before: prev
        ? {
            code: prev.code,
            type: prev.type,
            value: prev.value,
            active: prev.active,
          }
        : null,
      after: null,
    });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

