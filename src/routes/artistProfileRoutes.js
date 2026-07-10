const express = require("express");
const router = express.Router();

const artistProfileController = require("../controllers/artistProfileController");

// Get artist profile by user_id
router.get("/:id", artistProfileController.getProfile);

// Create or Update artist profile by user_id
router.post("/:id", artistProfileController.upsertProfile);

// You can also use PUT for updates
router.put("/:id", artistProfileController.upsertProfile);

// Delete artist profile by user_id
router.delete("/:id", artistProfileController.deleteProfile);

module.exports = router;