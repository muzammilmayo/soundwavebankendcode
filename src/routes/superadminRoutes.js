const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const superadminController = require("../controllers/superadminController");

// Dashboard
router.get(
  "/dashboard",
  verifyToken,
  checkPermission("manage_users"),
  superadminController.getDashboard
);

// Manage Users
router.get(
  "/users",
  verifyToken,
  checkPermission("manage_users"),
  superadminController.getUsers
);

// Update User Status (Activate/Deactivate)
router.put(
  "/users/:id/status",
  verifyToken,
  checkPermission("manage_users"),
  superadminController.updateUserStatus
);

// Update User Role (Promote/Demote)
router.put(
  "/users/:id/role",
  verifyToken,
  checkPermission("manage_users"),
  superadminController.updateUserRole
);

// Create Admin Account
router.post(
  "/users",
  verifyToken,
  checkPermission("manage_users"),
  superadminController.createAdmin
);

// Delete User Account
router.delete(
  "/users/:id",
  verifyToken,
  checkPermission("manage_users"),
  superadminController.deleteUser
);

// Manage Songs
router.get(
  "/songs",
  verifyToken,
  checkPermission("manage_songs"),
  superadminController.getSongs
);

// Upload Song
router.post(
  "/songs/upload",
  verifyToken,
  checkPermission("upload_song"),
  superadminController.uploadSong
);

// Edit Song
router.put(
  "/songs/:id",
  verifyToken,
  checkPermission("edit_own_song"),
  superadminController.editSong
);

// Delete Song
router.delete(
  "/songs/:id",
  verifyToken,
  checkPermission("delete_song"),
  superadminController.deleteSong
);

// Moderate Content
router.put(
  "/songs/:id/moderate",
  verifyToken,
  checkPermission("moderate_content"),
  superadminController.moderateContent
);

// Play Song
router.get(
  "/songs/play/:id",
  verifyToken,
  checkPermission("play_song"),
  superadminController.playSong
);

// Create Playlist
router.post(
  "/playlist",
  verifyToken,
  checkPermission("create_playlist"),
  superadminController.createPlaylist
);

// Manage Playlist
router.put(
  "/playlist/:id",
  verifyToken,
  checkPermission("manage_playlist"),
  superadminController.updatePlaylist
);

module.exports = router;