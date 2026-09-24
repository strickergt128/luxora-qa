import { authorizeRoles as _authorizeRoles } from "./authMiddleware.js";
import User from "../models/User.js";

// Re-export
export const authorizeRoles = (...roles) => _authorizeRoles(...roles);

// New: granular permissions (admin bypass; subadmin must have perms)
export const requirePermissions = (...perms) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // Full admins always pass
    if (req.user.role === "admin") return next();

    if (req.user.role === "subadmin") {
      const userPerms = new Set(req.user.permissions || []);
      const missing = perms.filter((p) => !userPerms.has(p));
      if (missing.length === 0) return next();
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    return res.status(403).json({ message: "Forbidden" });
  };
};

// New: seller-assistant granular permissions (seller bypass; admin/subadmin bypass)
export const requireSellerPermissions = (...perms) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // Admin/subadmin bypass (still need sellerId via withSellerScope if required)
    if (req.user.role === "admin" || req.user.role === "subadmin")
      return next();

    // Sellers can do everything in seller scope
    if (req.user.role === "seller") return next();

    // Seller assistants must have all required permissions
    if (req.user.role === "seller_assistant") {
      const userPerms = new Set(req.user.permissions || []);
      const missing = perms.filter((p) => !userPerms.has(p));
      if (missing.length === 0) return next();
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    return res.status(403).json({ message: "Forbidden" });
  };
};

const ALLOW_NON_MFA =
  String(process.env.MFA_GRACE_ALLOW_NON_MFA_ADMINS || "").toLowerCase() ===
  "true";

// Updated: allow admin and subadmin (MFA required for both)
export const requireAdminMFA = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const isAdminRole = req.user.role === "admin" || req.user.role === "subadmin";
  if (!isAdminRole) return res.status(403).json({ message: "Admin only" });

  if (ALLOW_NON_MFA && !req.user?.twoFA?.enabled) return next();

  if (!req.authClaims?.mfa)
    return res.status(403).json({ message: "Admin 2FA required" });

  next();
};

// Existing seller guard with seller scope (unchanged logic, import fixed)
export const requireApprovedSeller =
  (options = { allowAdmin: true }) =>
  (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (
      options.allowAdmin &&
      (req.user.role === "admin" || req.user.role === "subadmin")
    )
      return next();

    if (req.user.role !== "seller")
      return res.status(403).json({ message: "Seller role required" });

    if (!req.user?.seller?.approved)
      return res.status(403).json({ message: "Seller account not approved" });

    next();
  };

// Attach seller scope and authorize seller/seller_assistant (admin/subadmin optional)
export const withSellerScope =
  (options = { allowAdmin: true }) =>
  async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      // Seller: must be approved; scope to self
      if (req.user.role === "seller") {
        if (!req.user?.seller?.approved) {
          return res
            .status(403)
            .json({ message: "Seller account not approved" });
        }
        req.sellerId = req.user._id;
        return next();
      }

      // Seller assistant: must be linked to an approved seller
      if (req.user.role === "seller_assistant") {
        if (!req.user.assistantFor) {
          return res
            .status(403)
            .json({ message: "Assistant is not linked to a seller" });
        }
        const seller = await User.findById(req.user.assistantFor).select(
          "role seller"
        );
        if (!seller || seller.role !== "seller" || !seller.seller?.approved) {
          return res
            .status(403)
            .json({ message: "Linked seller not approved" });
        }
        req.sellerId = seller._id;
        return next();
      }

      // Admin/subadmin: allowed if allowAdmin, but must provide sellerId to scope
      const isAdminish =
        req.user.role === "admin" || req.user.role === "subadmin";
      if (options.allowAdmin && isAdminish) {
        const sid = req.query.sellerId || req.body?.sellerId;
        if (!sid) {
          return res
            .status(400)
            .json({ message: "sellerId required for admin access" });
        }
        const seller = await User.findById(sid).select("role seller");
        if (!seller || seller.role !== "seller" || !seller.seller?.approved) {
          return res
            .status(400)
            .json({ message: "Invalid sellerId or seller not approved" });
        }
        req.sellerId = seller._id;
        return next();
      }

      return res.status(403).json({ message: "Forbidden" });
    } catch (err) {
      return res.status(500).json({ message: "Internal server error" });
    }
  };

