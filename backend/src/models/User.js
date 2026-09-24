import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    // Expanded roles
    role: {
      type: String,
      enum: ["user", "seller", "admin", "subadmin", "seller_assistant"],
      default: "user",
    },
    permissions: { type: [String], default: [] },
    assistantFor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    tokenVersion: { type: Number, default: 0 },
    twoFA: {
      enabled: { type: Boolean, default: false },
      secret: { type: String },
      verifiedAt: { type: Date },
    },
    seller: {
      approved: { type: Boolean, default: false },
      approvedAt: { type: Date },
    },
    addresses: [
      {
        label: String,
        line1: String,
        line2: String,
        city: String,
        state: String,
        zip: String,
        country: String,
        phone: String,
        isDefault: { type: Boolean, default: false },
      },
    ],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    wishlistShare: {
      id: { type: String },
      enabled: { type: Boolean, default: false },
      createdAt: { type: Date },
    },
    alerts: {
      priceDropEnabled: { type: Boolean, default: false },
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    status: { type: String, enum: ["active", "blocked"], default: "active" },
    sellerRequest: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    sellerApplication: {
      businessName: String,
      legalName: String,
      phone: String,
      website: String,
      gst: String,
      address: String,
      message: String,
      documents: [{ url: String, name: String }],
      submittedAt: Date,
    },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ "wishlistShare.id": 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ assistantFor: 1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
