import jwt from "jsonwebtoken";
import crypto from "crypto";

// Small helper to parse durations like "15m", "30d", "1h"
const parseDurationToMs = (input) => {
  if (typeof input === "number") return input;
  if (!input) return 0;
  if (/^\d+$/.test(input)) return parseInt(input, 10); // assume ms
  const m = /^(\d+)\s*([smhdw])$/.exec(input);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const mult = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 }[unit];
  return n * mult;
};

export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
export const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "30d";
export const REFRESH_TOKEN_TTL_MS = parseDurationToMs(REFRESH_TOKEN_TTL);
export const REFRESH_COOKIE_NAME = "rt";
export const MFA_CHALLENGE_TTL = process.env.MFA_CHALLENGE_TTL || "5m";

// Access token (supports MFA claim)
export const signAccessToken = (user, opts = {}) => {
  const payload = {
    id: user._id,
    role: user.role,
    v: user.tokenVersion || 0,
    ...(opts.mfa ? { mfa: true } : {}),
  };
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_TTL });
};

export const verifyAccessToken = (token) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not configured");
  return jwt.verify(token, secret);
};

// MFA challenge tokens (read secrets lazily)
const getMfaSecret = () =>
  process.env.JWT_MFA_SECRET || process.env.JWT_ACCESS_SECRET;

export const signMFAChallenge = (payload, expiresIn = MFA_CHALLENGE_TTL) => {
  const secret = getMfaSecret();
  if (!secret) throw new Error("MFA signing secret is not configured");
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyMFAChallenge = (token) => {
  const secret = getMfaSecret();
  if (!secret) throw new Error("MFA verify secret is not configured");
  return jwt.verify(token, secret);
};

// Opaque token helpers
export const createOpaqueToken = (size = 64) =>
  crypto.randomBytes(size).toString("hex");
export const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const setRefreshTokenCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: "/",
  });
};

export const clearRefreshTokenCookie = (res) => {
  try {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
      path: "/",
    });
  } catch {}
  try {
    res.clearCookie("refreshToken");
  } catch {}
};
