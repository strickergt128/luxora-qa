import express from "express";
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  me,
  forgotPassword,
  resetPassword,
  adminMFAVerify,
  adminMFAEnrollInit,
  adminMFAEnrollVerify,
  restartAdmin2FA,
} from "../controllers/authController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  limitLogin,
  limitRegister,
  limitRefresh,
  limitForgotPassword,
  limitResetPassword,
} from "../middleware/rateLimit.js";
import { verifyHCaptcha } from "../middleware/captcha.js";

const router = express.Router();

router.post("/register", limitRegister, verifyHCaptcha(), registerUser);
router.post("/login", limitLogin, verifyHCaptcha(), loginUser);
router.post("/refresh", limitRefresh, refreshToken);
router.post("/logout", logoutUser);
router.get("/me", protect, me);

// Forgot/reset
router.post(
  "/forgot-password",
  limitForgotPassword,
  /* verifyHCaptcha(), */ forgotPassword
);
router.post("/reset-password/:token", limitResetPassword, resetPassword);

// Admin 2FA
router.post(
  "/admin-2fa/restart",
  protect,
  authorizeRoles("admin", "subadmin"),
  restartAdmin2FA
);
router.post("/admin-2fa/verify", limitLogin, adminMFAVerify);
router.post("/admin-2fa/enroll-init", limitLogin, adminMFAEnrollInit);
router.post("/admin-2fa/enroll-verify", limitLogin, adminMFAEnrollVerify);

export default router;
