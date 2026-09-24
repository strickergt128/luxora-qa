import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true }, // internal reference
    altText: { type: String, trim: true },

    // Media + link
    imageUrl: { type: String, required: true }, // /uploads/... or absolute
    linkUrl: { type: String, trim: true }, // internal or absolute

    // Placement
    placement: {
      type: String,
      enum: ["home_hero", "category_header"],
      required: true,
      index: true,
    },
    categorySlug: { type: String, trim: true }, // for category_header

    // Activation window
    active: { type: Boolean, default: true, index: true },
    startAt: { type: Date },
    endAt: { type: Date },
    priority: { type: Number, default: 0 }, // higher shows first

    // Analytics
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },

    // Brand-safe layout (backward compatible)
    layout: {
      type: String,
      enum: ["image_full", "split_asym"],
      default: "image_full",
    },
    imagePosition: {
      type: String,
      enum: ["left", "right"],
      default: "right",
    },
    imageFit: {
      type: String,
      enum: ["contain", "cover"],
      default: "contain",
    },

    // Content (for split_asym)
    headline: { type: String, trim: true },
    subheadline: { type: String, trim: true },
    ctaLabel: { type: String, trim: true },
  },
  { timestamps: true }
);

bannerSchema.index({
  placement: 1,
  active: 1,
  startAt: 1,
  endAt: 1,
  priority: -1,
});

const Banner = mongoose.model("Banner", bannerSchema);
export default Banner;
