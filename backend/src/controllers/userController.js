import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import { clearRefreshTokenCookie } from "../utils/token.js";

// ---------------- User Requests Seller Role ----------------

export const requestSellerRole = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      businessName = null,
      legalName = null,
      phone = null,
      website = null,
      gst = null,
      address = null,
      message = null,
      documents = [],
    } = body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.sellerRequest === "pending")
      return res.status(400).json({ message: "Request already pending" });

    if (user.sellerRequest === "approved")
      return res.status(400).json({ message: "Already a seller" });

    const hasForm =
      !!(
        businessName ||
        legalName ||
        phone ||
        website ||
        gst ||
        address ||
        message
      ) ||
      (Array.isArray(documents) && documents.length > 0);

    user.sellerRequest = "pending";
    user.sellerApplication = hasForm
      ? {
          businessName,
          legalName,
          phone,
          website,
          gst,
          address,
          message,
          documents: Array.isArray(documents) ? documents : [],
          submittedAt: new Date(),
        }
      : { submittedAt: new Date() };

    await user.save();

    res.json({
      message: "Seller request submitted",
      sellerRequest: user.sellerRequest,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update basic profile (name, email)
export const updateMe = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (email && email !== user.email) {
      const taken = await User.findOne({ email, _id: { $ne: user._id } });
      if (taken)
        return res.status(400).json({ message: "Email already in use" });
      user.email = email;
    }
    if (name) user.name = name;

    await user.save();
    const clean = await User.findById(user._id).select("-password");
    res.json(clean);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Change password — now revokes all refresh tokens and clears cookie
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "Both current and new password required" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await user.comparePassword(currentPassword);
    if (!ok)
      return res.status(400).json({ message: "Current password is incorrect" });

    user.password = newPassword; // will be hashed in pre-save
    user.tokenVersion = (user.tokenVersion || 0) + 1; // invalidate access tokens
    await user.save();

    // Revoke all refresh tokens for this user (all devices)
    await RefreshToken.updateMany(
      { user: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }
    );

    // Clear refresh cookie on this device
    clearRefreshTokenCookie(res);

    res.json({ message: "Password updated. Please log in again." });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Addresses CRUD
export const addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = req.body || {};
    if (addr.isDefault) {
      user.addresses.forEach((a) => (a.isDefault = false));
    }
    user.addresses.push(addr);
    await user.save();
    res.status(201).json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.id);
    if (!addr) return res.status(404).json({ message: "Address not found" });

    const fields = [
      "label",
      "line1",
      "line2",
      "city",
      "state",
      "zip",
      "country",
      "phone",
      "isDefault",
    ];
    for (const k of fields) {
      if (req.body[k] !== undefined) addr[k] = req.body[k];
    }
    if (req.body.isDefault === true) {
      user.addresses.forEach((a) => {
        a.isDefault = a._id.toString() === addr._id.toString();
      });
    }
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.id);
    if (!addr) return res.status(404).json({ message: "Address not found" });

    addr.deleteOne();
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.id);
    if (!addr) return res.status(404).json({ message: "Address not found" });

    user.addresses.forEach((a) => (a.isDefault = false));
    addr.isDefault = true;
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /users/me/alerts/price-drop
export const getPriceDropAlertsStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("alerts");
    res.json({ enabled: !!user?.alerts?.priceDropEnabled });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /users/me/alerts/price-drop { enabled: boolean }
export const setPriceDropAlertsStatus = async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const user = await User.findById(req.user._id).select("alerts");
    if (!user) return res.status(404).json({ message: "User not found" });
    user.alerts = user.alerts || {};
    user.alerts.priceDropEnabled = enabled;
    await user.save();
    res.json({ enabled: user.alerts.priceDropEnabled });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

