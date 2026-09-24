import User from "../models/User.js";
import bcrypt from "bcrypt";
import crypto, { randomBytes } from "crypto";
import speakeasy from "speakeasy";
import RefreshToken from "../models/RefreshToken.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import {
  signAccessToken,
  verifyAccessToken, // not used here
  createOpaqueToken,
  hashToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  REFRESH_TOKEN_TTL_MS,
  signMFAChallenge,
  verifyMFAChallenge,
} from "../utils/token.js";
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "../services/email/emailService.js";

const newFamilyId = () => crypto.randomBytes(16).toString("hex");
const clientMeta = (req) => ({ ip: req.ip, ua: req.get("user-agent") });

// Parse durations like "15m", "1h"
const parseDurationToMs = (input) => {
  if (typeof input === "number") return input;
  if (!input) return 0;
  if (/^\d+$/.test(input)) return parseInt(input, 10);
  const m = /^(\d+)\s*([smhdw])$/.exec(input);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const mult = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 }[m[2]];
  return n * mult;
};

const RESET_TOKEN_TTL = process.env.PASSWORD_RESET_TTL || "15m";
const RESET_TOKEN_TTL_MS = parseDurationToMs(RESET_TOKEN_TTL) || 15 * 60 * 1000;

const issueRefreshToken = async (user, req, res, family = null, opts = {}) => {
  const token = createOpaqueToken(64);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const familyId = family || newFamilyId();

  const doc = await RefreshToken.create({
    user: user._id,
    tokenHash,
    family: familyId,
    expiresAt,
    meta: { ...clientMeta(req), mfa: !!opts.mfa },
  });

  setRefreshTokenCookie(res, token);
  return { token, doc };
};

const sanitizeUser = (user) => {
  const u = user.toObject ? user.toObject() : user;
  delete u.password;
  delete u.twoFA?.secret;
  return u;
};

// Register (unchanged for non-admin)
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already used" });

    const finalRole = role === "seller" ? "seller" : "user";
    const user = await User.create({ name, email, password, role: finalRole });

    const accessToken = signAccessToken(user);
    await issueRefreshToken(user, req, res, null, { mfa: false });

    sendWelcomeEmail(user).catch((err) =>
      console.error("❌ Welcome email:", err.message)
    );

    res.status(201).json({ accessToken, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Login (admin requires 2FA challenge)
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    if (user.status === "blocked")
      return res.status(403).json({ message: "Account blocked" });

    if (user.role === "admin" || user.role === "subadmin") {
      if (user.twoFA?.enabled) {
        const challenge = signMFAChallenge({
          uid: String(user._id),
          stage: "verify",
        });
        return res.json({ twoFARequired: true, challenge });
      } else {
        const challenge = signMFAChallenge({
          uid: String(user._id),
          stage: "enroll",
        });
        return res.json({ twoFAEnrollRequired: true, challenge });
      }
    }

    // Non-admin: normal session
    const accessToken = signAccessToken(user);
    await issueRefreshToken(user, req, res, null, { mfa: false });

    res.json({ accessToken, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Admin 2FA: verify code and issue tokens
export const adminMFAVerify = async (req, res) => {
  try {
    const { challenge, code } = req.body || {};
    if (!challenge || !code)
      return res.status(400).json({ message: "Challenge and code required" });
    const payload = verifyMFAChallenge(challenge); // { uid, stage }
    if (payload.stage !== "verify")
      return res.status(400).json({ message: "Invalid challenge stage" });

    const user = await User.findById(payload.uid);
    if (!user || (user.role !== "admin" && user.role !== "subadmin"))
      return res.status(400).json({ message: "Invalid challenge" });
    if (!user.twoFA?.enabled || !user.twoFA?.secret)
      return res.status(400).json({ message: "2FA not enabled" });
    if (user.status === "blocked")
      return res.status(403).json({ message: "Account blocked" });

    const ok = speakeasy.totp.verify({
      secret: user.twoFA.secret,
      encoding: "base32",
      token: String(code),
      window: 1,
    });
    if (!ok) return res.status(400).json({ message: "Invalid code" });

    const accessToken = signAccessToken(user, { mfa: true });
    await issueRefreshToken(user, req, res, null, { mfa: true });
    return res.json({ accessToken, user: sanitizeUser(user) });
  } catch (err) {
    return res.status(400).json({ message: "Invalid or expired challenge" });
  }
};

// Admin 2FA enroll init: returns secret + otpauth + new challenge embedding secret
export const adminMFAEnrollInit = async (req, res) => {
  try {
    const { challenge } = req.body || {};
    if (!challenge)
      return res.status(400).json({ message: "Challenge required" });
    const payload = verifyMFAChallenge(challenge); // { uid, stage }
    if (payload.stage !== "enroll")
      return res.status(400).json({ message: "Invalid challenge stage" });

    const user = await User.findById(payload.uid);
    if (!user || (user.role !== "admin" && user.role !== "subadmin"))
      return res.status(400).json({ message: "Invalid challenge" });
    if (user.status === "blocked")
      return res.status(403).json({ message: "Account blocked" });

    const issuer = process.env.MFA_ISSUER || "Luxora";
    const accountName = user.email;

    const secret = speakeasy.generateSecret({
      length: 20,
      name: `${issuer}:${accountName}`,
      issuer,
    });

    // New challenge embedding secret for verify step
    const nextChallenge = signMFAChallenge({
      uid: String(user._id),
      stage: "enroll-verify",
      secret: secret.base32,
    });

    return res.json({
      challenge: nextChallenge,
      secretBase32: secret.base32,
      otpauthUrl: secret.otpauth_url,
      issuer,
      accountName,
    });
  } catch (err) {
    return res.status(400).json({ message: "Invalid or expired challenge" });
  }
};

// Admin 2FA enroll verify: persist secret, enable 2FA, issue tokens
export const adminMFAEnrollVerify = async (req, res) => {
  try {
    const { challenge, code } = req.body || {};
    if (!challenge || !code)
      return res.status(400).json({ message: "Challenge and code required" });

    const payload = verifyMFAChallenge(challenge); // { uid, stage, secret }
    if (payload.stage !== "enroll-verify" || !payload.secret)
      return res.status(400).json({ message: "Invalid challenge" });

    const user = await User.findById(payload.uid);
    if (!user || (user.role !== "admin" && user.role !== "subadmin"))
      return res.status(400).json({ message: "Invalid challenge" });

    if (user.status === "blocked")
      return res.status(403).json({ message: "Account blocked" });

    const ok = speakeasy.totp.verify({
      secret: payload.secret,
      encoding: "base32",
      token: String(code),
      window: 1,
    });
    if (!ok) return res.status(400).json({ message: "Invalid code" });

    user.twoFA = {
      enabled: true,
      secret: payload.secret,
      verifiedAt: new Date(),
    };
    await user.save();

    const accessToken = signAccessToken(user, { mfa: true });
    await issueRefreshToken(user, req, res, null, { mfa: true });

    return res.json({ accessToken, user: sanitizeUser(user) });
  } catch (err) {
    return res.status(400).json({ message: "Invalid or expired challenge" });
  }
};

// Admin 2FA: restart challenge for already logged-in admin/subadmin
export const restartAdmin2FA = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const role = String(req.user.role || "").toLowerCase();
    if (role !== "admin" && role !== "subadmin" && role !== "sub-admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    if (req.user.twoFA?.enabled) {
      const challenge = signMFAChallenge({
        uid: String(req.user._id),
        stage: "verify",
      });
      return res.json({ twoFARequired: true, challenge });
    } else {
      const challenge = signMFAChallenge({
        uid: String(req.user._id),
        stage: "enroll",
      });
      return res.json({ twoFAEnrollRequired: true, challenge });
    }
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Refresh with rotation + reuse detection (preserve MFA)
export const refreshToken = async (req, res) => {
  try {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const raw = req.cookies?.rt || req.cookies?.refreshToken;
    if (!raw) return res.status(401).json({ message: "No refresh token" });

    const tokenHash = hashToken(raw);
    const current = await RefreshToken.findOne({ tokenHash });
    if (!current) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const isExpired = current.expiresAt.getTime() <= Date.now();
    if (isExpired || current.revokedAt || current.replacedBy) {
      await RefreshToken.updateMany(
        {
          user: current.user,
          family: current.family,
          revokedAt: { $exists: false },
        },
        { $set: { revokedAt: new Date() } }
      );
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: "Refresh token reuse detected" });
    }

    const user = await User.findById(current.user);
    if (!user) {
      current.revokedAt = new Date();
      await current.save();
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: "User not found" });
    }

    if (user.status === "blocked") {
      current.revokedAt = new Date();
      await current.save();
      clearRefreshTokenCookie(res);
      return res.status(403).json({ message: "Account blocked" });
    }

    const mfa = !!current.meta?.mfa;

    const { doc: newTokenDoc } = await issueRefreshToken(
      user,
      req,
      res,
      current.family,
      { mfa }
    );

    current.replacedBy = newTokenDoc._id;
    await current.save();

    const newAccessToken = signAccessToken(user, { mfa });
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    clearRefreshTokenCookie(res);
    res.status(401).json({ message: "Invalid refresh token" });
  }
};

// Forgot Password — issues hashed, one-time token; also sets legacy fields for transition
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "No user with that email" }); // Keep behavior for compatibility

    // Invalidate previous reset tokens (new model)
    await PasswordResetToken.deleteMany({ user: user._id });

    // Create new token (raw + hashed)
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await PasswordResetToken.create({
      user: user._id,
      tokenHash,
      expiresAt,
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    // Legacy fields for transition
    user.resetPasswordToken = rawToken;
    user.resetPasswordExpires = Date.now() + RESET_TOKEN_TTL_MS;
    await user.save();

    await sendPasswordResetEmail(user, rawToken);
    res.json({ message: "Password reset email sent" });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Reset Password — prefer hashed token (new model), fallback to legacy fields
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || String(password).length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // 1) New flow: hashed token
    const tokenHash = hashToken(token);
    let prt = await PasswordResetToken.findOne({ tokenHash });

    if (prt) {
      const isExpired = prt.expiresAt.getTime() <= Date.now();
      const isUsed = !!prt.usedAt;
      if (isExpired || isUsed) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      const user = await User.findById(prt.user);
      if (!user) {
        // Clean up token record
        prt.usedAt = new Date();
        await prt.save();
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      // Update password + invalidate sessions
      user.password = password;
      user.resetPasswordToken = undefined; // clear legacy fields if any
      user.resetPasswordExpires = undefined;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      // Mark token as used and invalidate all remaining reset tokens for this user
      prt.usedAt = new Date();
      await prt.save();
      await PasswordResetToken.deleteMany({
        user: user._id,
        _id: { $ne: prt._id },
      });

      // Revoke all refresh tokens (all devices) and clear cookie
      await RefreshToken.updateMany(
        { user: user._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } }
      );
      clearRefreshTokenCookie(res);

      return res.json({ message: "Password reset successful" });
    }

    // 2) Legacy flow fallback
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    // Update password + clear legacy token + invalidate sessions
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Revoke all refresh tokens and clear cookie
    await RefreshToken.updateMany(
      { user: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }
    );
    clearRefreshTokenCookie(res);

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const raw = req.cookies?.rt || req.cookies?.refreshToken;
    if (raw) {
      const tokenHash = hashToken(raw);
      const doc = await RefreshToken.findOne({ tokenHash });
      if (doc && !doc.revokedAt) {
        doc.revokedAt = new Date();
        await doc.save();
      }
    }
  } catch (e) {
    // non-fatal
  } finally {
    clearRefreshTokenCookie(res);
    res.json({ message: "Logged out" });
  }
};

export const me = async (req, res) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.json(req.user);
};

