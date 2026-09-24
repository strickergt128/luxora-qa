import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    category: { type: String, index: true },
    tags: [{ type: String, index: true }],
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String },
      },
    ],
    // NEW: optional product video
    videoUrl: { type: String },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    avgRating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "blocked"], default: "active" },
    sku: { type: String, trim: true, index: true, sparse: true },
    brand: { type: String, trim: true },
    discountPrice: { type: Number, min: 0 },
    attributes: [
      {
        key: String,
        value: String,
      },
    ],
    seo: {
      title: String,
      description: String,
    },
    shipping: {
      weight: Number,
      length: Number,
      width: Number,
      height: Number,
    },
  },
  { timestamps: true }
);

// text & compound indexes
productSchema.index({ title: "text", description: "text" });
productSchema.index({ price: 1 });
productSchema.index({ owner: 1 });

// NEW: indexes for filters
productSchema.index({ avgRating: -1, ratingsCount: -1 });
productSchema.index({ stock: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ status: 1, category: 1, createdAt: -1 });
productSchema.index({ status: 1, price: 1 });

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// generate/refresh slug
productSchema.pre("save", function (next) {
  if (!this.isModified("title") && this.slug) return next();
  const base = slugify(this.title || "");
  this.slug = `${base}-${Math.random().toString(36).slice(2, 8)}`;
  next();
});

const Product = mongoose.model("Product", productSchema);
export default Product;
