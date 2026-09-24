import Review from "../models/Review.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

// ---------------- Add/Update Reviews ----------------

export const addReview = async (req, res) => {
  try {
    const { productId } = req.body;
    const rating = Number(req.body.rating);
    const comment =
      typeof req.body.comment === "string" ? req.body.comment : "";

    if (!productId || !rating) {
      return res
        .status(400)
        .json({ message: "productId and rating are required" });
    }

    // Check if user bought this product
    const order = await Order.findOne({
      user: req.user._id,
      "items.product": productId,
      status: { $ne: "cancelled" },
    });
    if (!order)
      return res.status(400).json({ message: "Purchase required to review" });

    // Parse media
    const images = [];
    let uploadedVideoUrl;

    if (req.files && (req.files.images?.length || req.files.video?.length)) {
      if (Array.isArray(req.files.images)) {
        for (const f of req.files.images.slice(0, 3)) {
          images.push({
            url:
              process.env.STORAGE_MODE === "cloud"
                ? f.path
                : `/uploads/${f.filename}`,
            alt: f.originalname || "",
          });
        }
      }
      if (Array.isArray(req.files.video) && req.files.video.length > 0) {
        const f = req.files.video[0];
        uploadedVideoUrl =
          process.env.STORAGE_MODE === "cloud"
            ? f.path
            : `/uploads/${f.filename}`;
      }
    }

    // Support optional videoUrl from body (if no file uploaded)
    const bodyVideoUrl =
      typeof req.body.videoUrl === "string" && req.body.videoUrl.trim()
        ? req.body.videoUrl.trim()
        : undefined;

    const finalVideoUrl = uploadedVideoUrl || bodyVideoUrl;

    let review = await Review.findOne({
      product: productId,
      user: req.user._id,
    });

    if (review) {
      // Update existing review
      review.rating = rating;
      review.comment = comment;
      review.verifiedPurchase = true;

      // Replace media if new provided
      const wantClearImages =
        typeof req.body.clearImages === "string" &&
        req.body.clearImages.toLowerCase() === "true";
      if (images.length > 0) {
        review.media.images = images;
      } else if (wantClearImages) {
        review.media.images = [];
      }

      if (uploadedVideoUrl || req.body.videoUrl !== undefined) {
        review.media.videoUrl = finalVideoUrl || undefined;
      }

      await review.save();
    } else {
      review = await Review.create({
        product: productId,
        user: req.user._id,
        rating,
        comment,
        media: {
          images,
          videoUrl: finalVideoUrl || undefined,
        },
        verifiedPurchase: true,
      });
    }

    // Recalculate product ratings
    const stats = await Review.aggregate([
      { $match: { product: review.product } },
      {
        $group: {
          _id: "$product",
          avgRating: { $avg: "$rating" },
          ratingsCount: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        avgRating: stats[0].avgRating,
        ratingsCount: stats[0].ratingsCount,
      });
    }

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Get Reviews ----------------

export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ product: productId })
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

