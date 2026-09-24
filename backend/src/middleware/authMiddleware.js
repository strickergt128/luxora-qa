import { verifyAccessToken } from "../utils/token.js";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer "))
      return res.status(401).json({ message: "No token" });

    const token = auth.split(" ")[1];
    const decoded = verifyAccessToken(token); // { id, role, v, mfa? }
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "User not found" });

    if ((user.tokenVersion || 0) !== (decoded.v || 0))
      return res.status(401).json({ message: "Token revoked" });

    if (user.status === "blocked")
      return res.status(403).json({ message: "Account blocked" });

    req.user = user;
    req.authClaims = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token invalid" });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};

export const attachUserIfPresent = async (req, _res, next) => {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.split(" ")[1];
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select("-password");
      if (
        user &&
        (user.tokenVersion || 0) === (decoded.v || 0) &&
        user.status !== "blocked"
      ) {
        req.user = user;
        req.authClaims = decoded;
      }
    }
  } catch {}
  next();
};
