const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permission.Middleware");
const adminController = require("../controllers/adminController");

// Dashboard
router.get(
  "/dashboard",
  verifyToken,
  checkPermission("manage_users"),
  adminController.getDashboard
);

// List Users (excluding Super Admins)
router.get(
  "/users",
  verifyToken,
  checkPermission("manage_users"),
  adminController.getUsers
);

// Toggle User Status (excluding Super Admins)
router.put(
  "/users/:id/status",
  verifyToken,
  checkPermission("manage_users"),
  adminController.updateUserStatus
);

// Manage Songs
router.get(
  "/songs",
  verifyToken,
  checkPermission("manage_songs"),
  adminController.getSongs
);

// Delete Song
router.delete(
  "/songs/:id",
  verifyToken,
  checkPermission("delete_song"),
  adminController.deleteSong
);

// Moderate Content
router.put(
  "/songs/:id/moderate",
  verifyToken,
  checkPermission("moderate_content"),
  adminController.moderateContent
);

module.exports = router;