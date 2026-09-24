import mongoose from "mongoose";

const AnalyticsEventSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },
    event: {
      type: String,
      enum: [
        "view",
        "cart",
        "checkout",
        "search",
        // Ad events
        "banner_impression",
        "banner_click",
        "sponsored_impression",
        "sponsored_click",
      ],
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    page: { type: String, default: null },
    meta: { type: Object, default: {} },
    ip: { type: String, default: "" },
    ua: { type: String, default: "" },
    ymd: { type: String, index: true }, // YYYY-MM-DD UTC
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { minimize: true }
);

AnalyticsEventSchema.pre("save", function (next) {
  if (!this.ymd && this.createdAt) {
    const d = new Date(this.createdAt);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    this.ymd = `${y}-${m}-${day}`;
  }
  next();
});

AnalyticsEventSchema.index({ ymd: 1, event: 1 });
AnalyticsEventSchema.index({ createdAt: 1, event: 1 });
AnalyticsEventSchema.index({ event: 1, createdAt: -1 });
AnalyticsEventSchema.index({ event: 1, "meta.query": 1, createdAt: -1 });

// De-dupe helpers
AnalyticsEventSchema.index({
  ymd: 1,
  event: 1,
  "meta.bannerId": 1,
  sessionId: 1,
});
AnalyticsEventSchema.index({
  ymd: 1,
  event: 1,
  "meta.placementId": 1,
  sessionId: 1,
});

export default mongoose.model("AnalyticsEvent", AnalyticsEventSchema);
