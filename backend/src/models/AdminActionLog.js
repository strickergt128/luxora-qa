import mongoose from "mongoose";

const adminActionLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true }, // e.g., "banner_create"
    entityType: {
      type: String,
      enum: [
        "user",
        "product",
        "order",
        "coupon",
        "media",
        "emailTemplate",
        "sellerRequest",
        // NEW types
        "banner",
        "sponsored",
      ],
      required: true,
      index: true,
    },
    entityId: { type: String, required: true, index: true },
    summary: { type: String },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    note: { type: String },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    changedByRole: { type: String, enum: ["admin"], default: "admin" },
    meta: {
      ip: String,
      ua: String,
    },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

adminActionLogSchema.index({ action: 1, createdAt: -1 });

const AdminActionLog = mongoose.model("AdminActionLog", adminActionLogSchema);
export default AdminActionLog;
