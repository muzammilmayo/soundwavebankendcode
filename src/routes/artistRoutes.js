const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const artistModeratorMiddleware = require("../middleware/artistModeratorMiddleware");
const upload = require('../middleware/uploadMiddleware');
const artistController = require("../controllers/artistController");

// Artist Dashboard
router.get(
  "/dashboard",
  verifyToken,
  artistModeratorMiddleware,
  artistController.getDashboard
);

// Artist Analytics
router.get(
  "/analytics",
  verifyToken,
  artistModeratorMiddleware,
  artistController.getAnalytics
);

// Upload Song
router.post(
  "/songs/upload",
  verifyToken,
  artistModeratorMiddleware,
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
  artistModeratorMiddleware,
  checkPermission("edit_own_song"),
  artistController.editSong
);

router.get("/profile", verifyToken, artistModeratorMiddleware, artistController.getProfile);
router.put("/profile", verifyToken, checkPermission("edit_profile"), artistController.updateProfile);
router.get("/albums", verifyToken, artistModeratorMiddleware, artistController.getAlbums);
router.get("/songs", verifyToken, artistModeratorMiddleware, artistController.getSongs);
router.get("/followers", verifyToken, artistModeratorMiddleware, artistController.getFollowers);

// Artist Moderators CRUD (Guarded by artistModeratorMiddleware)
router.post("/moderators", verifyToken, artistModeratorMiddleware, artistController.assignModerator);
router.get("/moderators", verifyToken, artistModeratorMiddleware, artistController.listModerators);
router.delete("/moderators/:id", verifyToken, artistModeratorMiddleware, artistController.removeModerator);
router.get("/search-listeners", verifyToken, artistModeratorMiddleware, artistController.searchListeners);

module.exports = router;