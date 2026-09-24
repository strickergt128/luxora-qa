import mongoose from "mongoose";

const emailTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true }, // e.g., welcome, resetPassword, orderConfirmation, orderDelivered, sellerApproved, sellerRejected
    subject: { type: String, required: true },
    html: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const EmailTemplate = mongoose.model("EmailTemplate", emailTemplateSchema);
export default EmailTemplate;
