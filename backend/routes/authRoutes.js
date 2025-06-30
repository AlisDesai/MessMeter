// backend/routes/authRoutes.js

const express = require("express");

// This comment was misleading, the import is correctly structured.
const {
  register,
  login,
  logout,
  confirmLogout,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  sendOTP,
  verifyOTP,
  resetPasswordWithToken,
} = require("../controllers/auth");

const { authenticate } = require("../middleware/auth");
const {
  validateRegister,
  validateLogin,
  validatePasswordUpdate,
  validateUpdateDetails,
  validateForgotPassword,
  validateResetPassword,
} = require("../middleware/validation");

const router = express.Router();

// Public routes
router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/forgotpassword", validateForgotPassword, forgotPassword);
router.put("/resetpassword/:resettoken", validateResetPassword, resetPassword);
router.get("/verify/:token", verifyEmail);

// NEW: Forgot Password OTP routes
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.put("/reset-password", resetPasswordWithToken);

// Protected routes
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, getMe);
router.put(
  "/updatedetails",
  authenticate,
  validateUpdateDetails,
  updateDetails
);

router.post("/confirm-logout", authenticate, confirmLogout);

router.put(
  "/updatepassword",
  authenticate,
  validatePasswordUpdate,
  updatePassword
);

module.exports = router;