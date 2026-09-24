import mongoose from "mongoose";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const CONTEXTS = ["user", "seller", "admin", "system"];

const orderStatusAuditSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    fromStatus: { type: String, enum: STATUSES, default: null },
    toStatus: { type: String, enum: STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional (system)
    changedByRole: {
      type: String,
      enum: ["user", "seller", "admin", "system"],
      default: "system",
    },
    context: { type: String, enum: CONTEXTS, required: true },
    note: { type: String },
    meta: {
      ip: String,
      ua: String,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Query efficiency
orderStatusAuditSchema.index({ order: 1, createdAt: 1 });

const OrderStatusAudit = mongoose.model(
  "OrderStatusAudit",
  orderStatusAuditSchema
);
export default OrderStatusAudit;
