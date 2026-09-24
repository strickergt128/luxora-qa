import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true },

    // NEW: media and verified purchase
    media: {
      images: [
        {
          url: { type: String, required: true },
          alt: { type: String },
          _id: false,
        },
      ],
      videoUrl: { type: String },
    },
    verifiedPurchase: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent duplicate reviews by same user on same product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);
export default Review;
