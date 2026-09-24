import AdminActionLog from "../models/AdminActionLog.js";

const ipOf = (req) =>
  req?.ip ||
  (Array.isArray(req?.headers?.["x-forwarded-for"])
    ? req.headers["x-forwarded-for"][0]
    : req?.headers?.["x-forwarded-for"] || ""
  )
    .toString()
    .split(",")[0]
    .trim() ||
  req?.connection?.remoteAddress ||
  "unknown";

const mapEntityType = (t) => {
  if (!t) return t;
  if (t === "Banner" || t === "banner") return "banner";
  if (
    t === "SponsoredPlacement" ||
    t === "sponsoredPlacement" ||
    t === "Sponsored" ||
    t === "sponsored"
  ) {
    return "sponsored";
  }
  return t;
};

export const logAdminAction = async (
  req,
  { action, entityType, entityId, summary, before, after, note }
) => {
  try {
    const admin = req?.user;
    await AdminActionLog.create({
      action,
      entityType: mapEntityType(entityType),
      entityId: String(entityId),
      summary: summary?.slice(0, 500),
      before,
      after,
      note,
      changedBy: admin?._id || undefined,
      changedByRole: "admin",
      meta: {
        ip: ipOf(req),
        ua: req?.get?.("user-agent") || "",
      },
    });
  } catch (err) {
    console.error("[adminLog] failed:", err?.message || err);
  }
};
