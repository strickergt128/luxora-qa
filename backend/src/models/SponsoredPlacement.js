import mongoose from "mongoose";

const sponsoredPlacementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paused"],
      default: "approved",
      index: true,
    },

    startAt: { type: Date },
    endAt: { type: Date },
    priority: { type: Number, default: 0 },

    // Targeting: show preferentially on this category
    targetCategorySlug: { type: String, trim: true, index: true },

    // Simple metrics
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

sponsoredPlacementSchema.index({
  status: 1,
  startAt: 1,
  endAt: 1,
  priority: -1,
  createdAt: -1,
});

const SponsoredPlacement = mongoose.model(
  "SponsoredPlacement",
  sponsoredPlacementSchema
);
export default SponsoredPlacement;
