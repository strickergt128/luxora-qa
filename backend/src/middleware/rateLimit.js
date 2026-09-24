import mongoose from "mongoose";
import { RateLimiterMongo, RateLimiterMemory } from "rate-limiter-flexible";

// ---- Env flags ----
const flag = (name, def = false) =>
  String(process.env[name] ?? "").toLowerCase() === "true" ||
  (def && process.env[name] === undefined);

const IS_PROD = process.env.NODE_ENV === "production";
const RL_DISABLED = flag("RL_DISABLED", false); // completely disable
const RL_RELAXED = flag("RL_RELAXED", !IS_PROD); // relaxed limits in dev by default
const RL_ALLOW_LOCAL = flag("RL_ALLOW_LOCAL", true); // bypass localhost in dev by default

// ---- Helpers ----
const limiterCache = new Map();

const waitForMongoose = async (timeoutMs = 5000) => {
  if (mongoose.connection.readyState === 1) return true;
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => {
      const done = () => {
        mongoose.connection.off("connected", done);
        resolve(null);
      };
      mongoose.connection.on("connected", done);
      setTimeout(done, timeoutMs);
    });
    return mongoose.connection.readyState === 1;
  }
  await new Promise((r) => setTimeout(r, 50));
  return mongoose.connection.readyState === 1;
};

const getLimiter = async ({ keyPrefix, points, duration, blockDuration }) => {
  if (limiterCache.has(keyPrefix)) return limiterCache.get(keyPrefix);

  let limiter;
  try {
    const ready = await waitForMongoose();
    if (ready) {
      const client = mongoose.connection.getClient();
      const opts = {
        storeClient: client,
        tableName: "rateLimits",
        points,
        duration,
        blockDuration,
        keyPrefix,
      };
      if (mongoose.connection?.db?.databaseName) {
        opts.dbName = mongoose.connection.db.databaseName;
      }
      limiter = new RateLimiterMongo(opts);
    } else {
      limiter = new RateLimiterMemory({
        points,
        duration,
        blockDuration,
        keyPrefix,
      });
    }
  } catch {
    limiter = new RateLimiterMemory({
      points,
      duration,
      blockDuration,
      keyPrefix,
    });
  }

  limiterCache.set(keyPrefix, limiter);
  return limiter;
};

const setHeadersFromRes = (res, rlRes) => {
  if (!rlRes) return;
  res.set("X-RateLimit-Remaining", String(rlRes.remainingPoints ?? 0));
  res.set(
    "X-RateLimit-Reset",
    String(Math.ceil((rlRes.msBeforeNext ?? 0) / 1000))
  );
};

const handleRejection = (
  res,
  rejRes,
  message = "Too many requests, please try again later"
) => {
  const retrySec = Math.ceil((rejRes?.msBeforeNext ?? 0) / 1000);
  if (retrySec > 0) res.set("Retry-After", String(retrySec));
  res.status(429).json({ message });
};

const consumeOrBlock = async (req, res, options, key) => {
  const limiter = await getLimiter(options);
  try {
    const rlRes = await limiter.consume(key);
    setHeadersFromRes(res, rlRes);
    return true;
  } catch (rejRes) {
    handleRejection(res, rejRes);
    return false;
  }
};

const ipOf = (req) =>
  req.ip ||
  (Array.isArray(req.headers["x-forwarded-for"])
    ? req.headers["x-forwarded-for"][0]
    : req.headers["x-forwarded-for"] || ""
  )
    .toString()
    .split(",")[0]
    .trim() ||
  req.connection?.remoteAddress ||
  "unknown";

const isLocalIp = (ip) =>
  ip === "127.0.0.1" ||
  ip === "::1" ||
  ip === "::ffff:127.0.0.1" ||
  ip.startsWith("::ffff:127.0.0.1");

// ---- Base windows (seconds) ----
const ONE_MIN = 60;
const FIFTEEN_MIN = 15 * 60;
const ONE_HOUR = 60 * 60;
const DAY = 24 * 60 * 60;

// Helper to pick relaxed values in dev
const pick = (base, relaxed) => (RL_RELAXED ? { ...base, ...relaxed } : base);

// ---- Configs (relaxed in dev) ----
// Login
const loginIpCfg = pick(
  {
    keyPrefix: "rl:login:ip",
    points: 10,
    duration: FIFTEEN_MIN,
    blockDuration: FIFTEEN_MIN,
  },
  { points: 200, duration: FIFTEEN_MIN, blockDuration: 60 }
);
const loginEmailCfg = pick(
  {
    keyPrefix: "rl:login:email",
    points: 5,
    duration: FIFTEEN_MIN,
    blockDuration: FIFTEEN_MIN,
  },
  { points: 50, duration: FIFTEEN_MIN, blockDuration: 60 }
);

// Register
const registerIpCfg = pick(
  {
    keyPrefix: "rl:register:ip",
    points: 5,
    duration: ONE_HOUR,
    blockDuration: ONE_HOUR,
  },
  { points: 60, duration: ONE_HOUR, blockDuration: 60 }
);

// Refresh
const refreshIpCfg = pick(
  {
    keyPrefix: "rl:refresh:ip",
    points: 100,
    duration: FIFTEEN_MIN,
    blockDuration: 5 * 60,
  },
  { points: 500, duration: FIFTEEN_MIN, blockDuration: 30 }
);

// Forgot password
const forgotIpCfg = pick(
  {
    keyPrefix: "rl:forgot:ip",
    points: 5,
    duration: ONE_HOUR,
    blockDuration: ONE_HOUR,
  },
  { points: 60, duration: FIFTEEN_MIN, blockDuration: 60 }
);
const forgotEmailCfg = pick(
  {
    keyPrefix: "rl:forgot:email",
    points: 3,
    duration: DAY,
    blockDuration: DAY,
  },
  { points: 50, duration: ONE_HOUR, blockDuration: 60 }
);

// Reset password
const resetIpCfg = pick(
  {
    keyPrefix: "rl:reset:ip",
    points: 10,
    duration: ONE_HOUR,
    blockDuration: ONE_HOUR,
  },
  { points: 120, duration: FIFTEEN_MIN, blockDuration: 60 }
);

// Contact form
const contactIpCfg = pick(
  {
    keyPrefix: "rl:contact:ip",
    points: 5, // 5 requests
    duration: ONE_MIN, // per minute
    blockDuration: ONE_MIN, // block for 1 minute
  },
  { points: 60, duration: ONE_MIN, blockDuration: 30 }
);

// ---- Middlewares ----
const bypassIfDisabledOrLocal = (req) => {
  if (RL_DISABLED) return true;
  if (RL_ALLOW_LOCAL && !IS_PROD && isLocalIp(ipOf(req))) return true;
  return false;
};

export const limitLogin = async (req, res, next) => {
  if (bypassIfDisabledOrLocal(req)) return next();
  const ip = ipOf(req);
  if (!(await consumeOrBlock(req, res, loginIpCfg, ip))) return;
  const email = (req.body?.email || "").toLowerCase().trim();
  if (email) {
    if (!(await consumeOrBlock(req, res, loginEmailCfg, `email:${email}`)))
      return;
  }
  next();
};

export const limitRegister = async (req, res, next) => {
  if (bypassIfDisabledOrLocal(req)) return next();
  const ip = ipOf(req);
  if (!(await consumeOrBlock(req, res, registerIpCfg, ip))) return;
  next();
};

export const limitRefresh = async (req, res, next) => {
  if (bypassIfDisabledOrLocal(req)) return next();
  const ip = ipOf(req);
  if (!(await consumeOrBlock(req, res, refreshIpCfg, ip))) return;
  next();
};

export const limitForgotPassword = async (req, res, next) => {
  if (bypassIfDisabledOrLocal(req)) return next();
  const ip = ipOf(req);
  if (!(await consumeOrBlock(req, res, forgotIpCfg, ip))) return;
  const email = (req.body?.email || "").toLowerCase().trim();
  if (email) {
    if (!(await consumeOrBlock(req, res, forgotEmailCfg, `email:${email}`)))
      return;
  }
  next();
};

export const limitResetPassword = async (req, res, next) => {
  if (bypassIfDisabledOrLocal(req)) return next();
  const ip = ipOf(req);
  if (!(await consumeOrBlock(req, res, resetIpCfg, ip))) return;
  next();
};

export const limitContact = async (req, res, next) => {
  if (bypassIfDisabledOrLocal(req)) return next();
  const ip = ipOf(req);
  if (!(await consumeOrBlock(req, res, contactIpCfg, ip))) return;
  next();
};
