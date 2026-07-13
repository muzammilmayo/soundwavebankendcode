const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const listenerController = require("../controllers/listenerController");

// Listener Dashboard
router.get(
  "/dashboard",
  verifyToken,
  listenerController.getDashboard
);

// Play Song
router.get(
  "/songs/play/:id",
  verifyToken,
  checkPermission("play_song"),
  listenerController.playSong
);

// Create Playlist
router.post(
  "/playlist",
  verifyToken,
  checkPermission("create_playlist"),
  listenerController.createPlaylist
);

// Get User State (Playlists, Likes, Saved Albums, Followed Artists)
router.get(
  "/state",
  verifyToken,
  listenerController.getState
);

// Save User State (Playlists, Likes, Saved Albums, Followed Artists)
router.post(
  "/state",
  verifyToken,
  listenerController.saveState
);

module.exports = router;