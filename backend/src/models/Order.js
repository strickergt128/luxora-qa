import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    qty: { type: Number, required: true },
    price: { type: Number, required: true }, // snapshot of price
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],

    // Server-validated totals
    subtotal: { type: Number, required: true }, // sum(items.price * qty)
    tax: { type: Number, required: true }, // computed from subtotal
    shippingMethod: {
      type: String,
      enum: ["standard", "express"],
      required: true,
    },
    shippingCost: { type: Number, required: true },
    totalAmount: { type: Number, required: true }, // subtotal + tax + shippingCost

    address: { type: String, required: true },
    paymentMethod: { type: String, enum: ["COD"], default: "COD" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    appliedCoupon: {
      code: String,
      type: { type: String, enum: ["percent", "fixed"] },
      value: Number,
      discountAmount: Number,
      _id: false,
    },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "items.product": 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;
