import mongoose from "mongoose";

const returnItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // snapshot from order
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String },
  },
  { _id: false }
);

const refundSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["manual", "bank", "upi"],
      default: "manual",
    },
    reference: { type: String },
    amount: { type: Number, min: 0 },
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: { type: [returnItemSchema], required: true },
    reason: { type: String },
    note: { type: String },
    attachments: { type: [attachmentSchema], default: [] },

    status: {
      type: String,
      enum: [
        "requested",
        "approved",
        "rejected",
        "received",
        "refunded",
        "cancelled",
      ],
      default: "requested",
      index: true,
    },

    refund: refundSchema,

    requestedAt: { type: Date, default: Date.now, index: true },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    receivedAt: { type: Date },
    refundedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

returnRequestSchema.index({ order: 1, status: 1, requestedAt: -1 });

const ReturnRequest = mongoose.model("ReturnRequest", returnRequestSchema);
export default ReturnRequest;
