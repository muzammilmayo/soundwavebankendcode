const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permission.Middleware");
const artistController = require("../controllers/artistController");

// Artist Dashboard
router.get(
  "/dashboard",
  verifyToken,
  artistController.getDashboard
);

// Upload Song
router.post(
  "/songs/upload",
  verifyToken,
  checkPermission("upload_song"),
  artistController.uploadSong
);

// Edit Own Song
router.put(
  "/songs/:id",
  verifyToken,
  checkPermission("edit_own_song"),
  artistController.editSong
);

module.exports = router;