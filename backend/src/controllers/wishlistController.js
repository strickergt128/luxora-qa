import crypto from "crypto";
import User from "../models/User.js";
import Product from "../models/Product.js";

// ---------------- Get wishlist ----------------
export const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("wishlist");
    res.json(user.wishlist);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Add product to wishlist ----------------
export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const user = await User.findById(req.user._id);
    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    res.json({ message: "Added to wishlist", wishlist: user.wishlist });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Remove product from wishlist ----------------
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user._id);

    user.wishlist = user.wishlist.filter(
      (id) => id.toString() !== productId.toString()
    );
    await user.save();

    res.json({ message: "Removed from wishlist", wishlist: user.wishlist });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Shareable wishlist: PUBLIC GET by shareId ----------------
export const getSharedWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({
      "wishlistShare.id": id,
      "wishlistShare.enabled": true,
    }).populate({
      path: "wishlist",
      select:
        "title price images brand discountPrice avgRating ratingsCount slug status",
    });

    if (!user) return res.status(404).json({ message: "Not found" });

    // Optionally filter out blocked products
    const items = (user.wishlist || []).filter(
      (p) => p.status === "active" || !p.status
    );
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Share status (protected) ----------------
export const getWishlistShareStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("wishlistShare");
    const s = user?.wishlistShare;
    res.json({
      enabled: !!s?.enabled,
      id: s?.id || null,
      createdAt: s?.createdAt || null,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

async function generateUniqueShareId() {
  let id = "";
  for (let i = 0; i < 5; i++) {
    id = crypto.randomBytes(6).toString("hex");
    const exists = await User.exists({ "wishlistShare.id": id });
    if (!exists) break;
    id = "";
  }
  return id || crypto.randomBytes(8).toString("hex");
}

// Always generate a new ID when enabling
export const enableWishlistShare = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("wishlistShare");
    if (!user) return res.status(404).json({ message: "User not found" });

    const id = await generateUniqueShareId();
    user.wishlistShare = {
      id,
      enabled: true,
      createdAt: new Date(),
    };

    await user.save();
    res.json(user.wishlistShare);
  } catch (err) {
    if (String(err?.code) === "11000") {
      // rare collision: rotate once more
      const user = await User.findById(req.user._id).select("wishlistShare");
      const id = await generateUniqueShareId();
      user.wishlistShare = { id, enabled: true, createdAt: new Date() };
      await user.save();
      return res.json(user.wishlistShare);
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

// Disable and CLEAR the id so it can never be reused
export const disableWishlistShare = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("wishlistShare");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Completely clear share object
    user.wishlistShare = undefined;
    await user.save();

    res.json({ enabled: false, id: null });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

