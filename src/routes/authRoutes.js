const express = require("express");
const router = express.Router();

const {
  register,
  login,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const verifyToken = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

// =========================
// Public Routes
// =========================

// Register
router.post("/register", register);

// Login
router.post("/login", login);

// Forgot Password
router.post("/forgot-password", forgotPassword);

// Reset Password
router.put("/reset-password/:token", resetPassword);

// =========================
// Protected Routes
// =========================

// Profile
router.get("/profile", verifyToken, userController.getProfile);
router.put("/profile", verifyToken, userController.updateProfile);

// Change Password
router.put("/change-password", verifyToken, changePassword);

// Logout
router.post("/logout", verifyToken, logout);

module.exports = router;