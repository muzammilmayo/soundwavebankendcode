const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const upload = require('../middleware/uploadMiddleware');
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
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover_image', maxCount: 1 }
  ]),
  artistController.uploadSong
);

// Edit Own Song
router.put(
  "/songs/:id",
  verifyToken,
  checkPermission("edit_own_song"),
  artistController.editSong
);

router.get("/profile", verifyToken, artistController.getProfile);
router.put("/profile", verifyToken, checkPermission("edit_profile"), artistController.updateProfile);
router.get("/albums", verifyToken, artistController.getAlbums);
router.get("/songs", verifyToken, artistController.getSongs);

module.exports = router;