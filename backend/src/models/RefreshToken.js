import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: "RefreshToken" },
    revokedAt: { type: Date },
    meta: {
      ip: String,
      ua: String,
      device: String,
      location: String,
      mfa: { type: Boolean, default: false }, // <-- added
    },
  },
  { timestamps: false }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
export default RefreshToken;
