import OrderStatusAudit from "../models/OrderStatusAudit.js";

export const ALLOWED_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

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

export const logOrderStatusChange = async (req, params) => {
  try {
    const {
      orderId,
      fromStatus = null,
      toStatus,
      context = "system",
      note,
      changedBy = req?.user?._id || null,
      changedByRole = req?.user?.role || "system",
    } = params;

    if (!orderId || !toStatus) return;

    await OrderStatusAudit.create({
      order: orderId,
      fromStatus,
      toStatus,
      context,
      note,
      changedBy,
      changedByRole,
      meta: {
        ip: ipOf(req),
        ua: req?.get?.("user-agent") || "",
      },
    });
  } catch (err) {
    // Non-fatal: do not block main flow
    console.error(
      "[audit] failed to log order status change:",
      err?.message || err
    );
  }
};
