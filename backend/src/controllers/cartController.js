import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";

// Helpers
function computeSubtotal(items) {
  return (items || []).reduce(
    (sum, i) =>
      sum + Number(i.priceAtAdd ?? i.product?.price ?? 0) * Number(i.qty ?? 0),
    0
  );
}

function nowInRange(c) {
  const now = new Date();
  if (c.startsAt && now < new Date(c.startsAt)) return false;
  if (c.expiresAt && now > new Date(c.expiresAt)) return false;
  return true;
}

function isItemEligible(item, coupon) {
  const hasCat =
    Array.isArray(coupon.allowedCategories) &&
    coupon.allowedCategories.length > 0;
  const hasBrand =
    Array.isArray(coupon.allowedBrands) && coupon.allowedBrands.length > 0;

  if (!hasCat && !hasBrand) return true; // no scope → all eligible

  const cat = item.product?.category || "";
  const brand = item.product?.brand || "";

  const catOk = hasCat ? coupon.allowedCategories.includes(cat) : false;
  const brandOk = hasBrand ? coupon.allowedBrands.includes(brand) : false;

  // inclusive OR
  return catOk || brandOk;
}

function computeEligibleSubtotal(items, coupon) {
  if (!coupon) return 0;
  const hasScope =
    (coupon.allowedCategories && coupon.allowedCategories.length) ||
    (coupon.allowedBrands && coupon.allowedBrands.length);
  if (!hasScope) return computeSubtotal(items);

  return (items || []).reduce((sum, i) => {
    if (!i || !i.product) return sum;
    if (!isItemEligible(i, coupon)) return sum;
    return (
      sum + Number(i.priceAtAdd ?? i.product?.price ?? 0) * Number(i.qty ?? 0)
    );
  }, 0);
}

function computeDiscount(coupon, items) {
  if (!coupon || !coupon.active) return 0;
  if (!nowInRange(coupon)) return 0;

  const eligibleSubtotal = computeEligibleSubtotal(items, coupon);
  if (eligibleSubtotal <= 0) return 0;

  let discount = 0;
  if (coupon.type === "percent") {
    discount = Math.round((eligibleSubtotal * Number(coupon.value || 0)) / 100);
    if (coupon.maxDiscount != null)
      discount = Math.min(discount, Number(coupon.maxDiscount));
  } else if (coupon.type === "fixed") {
    discount = Math.round(Number(coupon.value || 0));
  }

  discount = Math.max(0, Math.min(discount, eligibleSubtotal));
  return discount;
}

async function validateCouponForUser(coupon, items, userId) {
  const subtotal = computeSubtotal(items);

  if (!coupon) return { ok: false, reason: "Invalid code" };
  if (!coupon.active) return { ok: false, reason: "Coupon inactive" };
  if (!nowInRange(coupon))
    return { ok: false, reason: "Coupon not in active window" };
  if (coupon.minOrderValue && subtotal < coupon.minOrderValue)
    return { ok: false, reason: `Minimum order ₹${coupon.minOrderValue}` };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, reason: "Coupon usage limit reached" };
  if (coupon.perUserLimit != null) {
    const entry = (coupon.usedBy || []).find(
      (u) => String(u.user) === String(userId)
    );
    const used = entry?.count || 0;
    if (used >= coupon.perUserLimit)
      return { ok: false, reason: "Per-user limit reached" };
  }

  const discount = computeDiscount(coupon, items);
  if (discount <= 0) return { ok: false, reason: "No eligible items" };

  return { ok: true, discount };
}

// ---------------- Get cart ----------------
export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product"
    );
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const subtotal = computeSubtotal(cart.items);
    let discount = 0;
    let couponInfo = null;
    let couponError = null;

    if (cart.appliedCoupon?.code) {
      const coupon = await Coupon.findOne({ code: cart.appliedCoupon.code });
      if (coupon) {
        const val = await validateCouponForUser(
          coupon,
          cart.items,
          req.user._id
        );
        if (val.ok) {
          discount = val.discount;
          couponInfo = {
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
          };
        } else {
          couponError = val.reason;
        }
      } else {
        couponError = "Invalid code";
      }
    }

    res.json({
      items: cart.items,
      appliedCoupon: couponInfo,
      couponError,
      subtotal,
      discount,
      discountedSubtotal: Math.max(0, subtotal - discount),
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Add item to cart ----------------
export const addToCart = async (req, res) => {
  try {
    const { productId, qty } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.stock < qty)
      return res.status(400).json({ message: "Not enough stock" });

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const existing = cart.items.find((i) => i.product.toString() === productId);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.items.push({ product: productId, qty, priceAtAdd: product.price });
    }

    await cart.save();
    await cart.populate("items.product");

    const subtotal = computeSubtotal(cart.items);
    res.json({
      items: cart.items,
      subtotal,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Update cart item quantity ----------------
export const updateCartItem = async (req, res) => {
  try {
    const { qty } = req.body;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const product = await Product.findById(item.product);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.stock < qty)
      return res.status(400).json({ message: "Not enough stock" });

    item.qty = qty;
    await cart.save();
    await cart.populate("items.product");

    const subtotal = computeSubtotal(cart.items);
    res.json({
      items: cart.items,
      subtotal,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Remove item from cart ----------------
export const removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item =
      cart.items.id(itemId) ||
      cart.items.find((i) => i.product.toString() === itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.deleteOne();
    await cart.save();
    await cart.populate("items.product");

    const subtotal = computeSubtotal(cart.items);
    res.json({
      items: cart.items,
      subtotal,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Apply coupon ----------------
export const applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product"
    );
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const coupon = await Coupon.findOne({
      code: String(code || "")
        .toUpperCase()
        .trim(),
    });
    const val = await validateCouponForUser(coupon, cart.items, req.user._id);
    if (!val.ok) return res.status(400).json({ message: val.reason });

    cart.appliedCoupon = { code: coupon.code, appliedAt: new Date() };
    await cart.save();

    const subtotal = computeSubtotal(cart.items);
    res.json({
      items: cart.items,
      appliedCoupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
      subtotal,
      discount: val.discount,
      discountedSubtotal: Math.max(0, subtotal - val.discount),
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------- Remove coupon ----------------
export const removeCoupon = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product"
    );
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.appliedCoupon = undefined;
    await cart.save();

    const subtotal = computeSubtotal(cart.items);
    res.json({
      items: cart.items,
      subtotal,
      appliedCoupon: null,
      discount: 0,
      discountedSubtotal: subtotal,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

