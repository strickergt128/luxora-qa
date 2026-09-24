import mongoose from "mongoose";

const priceAlertLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // The new effective price for which we sent the alert
    price: { type: Number, required: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One alert per unique (user, product, price)
priceAlertLogSchema.index({ user: 1, product: 1, price: 1 }, { unique: true });

const PriceAlertLog = mongoose.model("PriceAlertLog", priceAlertLogSchema);
export default PriceAlertLog;
