const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const artistProfileController = require("../controllers/artistProfileController");
const imageUpload = require("../middleware/imageUploadMiddleware");

const uploadFields = imageUpload.fields([
  { name: 'profile_image', maxCount: 1 },
  { name: 'cover_image', maxCount: 1 }
]);

// Get artist profile by user_id
router.get("/:id", verifyToken, artistProfileController.getProfile);

// Create or Update artist profile by user_id
router.post("/:id", verifyToken, uploadFields, artistProfileController.upsertProfile);

// You can also use PUT for updates
router.put("/:id", verifyToken, uploadFields, artistProfileController.upsertProfile);

// Delete artist profile by user_id
router.delete("/:id", verifyToken, artistProfileController.deleteProfile);

module.exports = router;