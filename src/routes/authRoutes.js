const express = require("express");
const router = express.Router();

const {
  register,
  login,
  logout,
  heartbeat,
  changePassword,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const verifyToken = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");
const { authLimiter } = require("../middleware/rateLimiter");
const RequestValidator = require("../validators");

// =========================
// Public Auth Routes (Hardened with rate limiting & schema validation)
// =========================

// Register
router.post(
  "/register", 
  authLimiter, 
  RequestValidator.validateRegister(), 
  register
);

// Login
router.post(
  "/login", 
  authLimiter, 
  RequestValidator.validateLogin(), 
  login
);

// Forgot Password
router.post(
  "/forgot-password", 
  authLimiter, 
  RequestValidator.validateForgotPassword(), 
  forgotPassword
);

// Reset Password
router.put(
  "/reset-password/:token", 
  authLimiter, 
  RequestValidator.validateResetPassword(), 
  resetPassword
);
router.put(
  "/reset-password", 
  authLimiter, 
  RequestValidator.validateResetPassword(), 
  resetPassword
);
router.post(
  "/reset-password/:token", 
  authLimiter, 
  RequestValidator.validateResetPassword(), 
  resetPassword
);
router.post(
  "/reset-password", 
  authLimiter, 
  RequestValidator.validateResetPassword(), 
  resetPassword
);

// =========================
// Protected User Routes
// =========================

// Profile
router.get("/profile", verifyToken, userController.getProfile);
router.put("/profile", verifyToken, userController.updateProfile);

// Change Password
router.put("/change-password", verifyToken, authLimiter, changePassword);

// Logout
router.post("/logout", verifyToken, logout);

// Heartbeat (keeps user online)
router.post("/heartbeat", verifyToken, heartbeat);

// Delete Own Account
router.delete("/account", verifyToken, userController.deleteAccount);

module.exports = router;