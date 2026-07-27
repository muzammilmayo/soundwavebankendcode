const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const moderatorController = require("../controllers/moderatorController");

// Reports endpoints
router.get("/reports", verifyToken, checkPermission("moderate_content"), moderatorController.getReports);
router.post("/reports", verifyToken, moderatorController.createReport); // Listeners can create reports
router.put("/reports/:id/resolve", verifyToken, checkPermission("moderate_content"), moderatorController.resolveReport);
router.put("/reports/:id/dismiss", verifyToken, checkPermission("moderate_content"), moderatorController.dismissReport);

// Catalog listing and status management for moderator
router.get("/songs", verifyToken, checkPermission("moderate_content"), moderatorController.getSongs);
router.get("/albums", verifyToken, checkPermission("moderate_content"), moderatorController.getAlbums);
router.get("/users", verifyToken, checkPermission("moderate_content"), moderatorController.getUsers);

router.put("/songs/:id/status", verifyToken, checkPermission("moderate_content"), moderatorController.updateSongStatus);
router.put("/albums/:id/status", verifyToken, checkPermission("moderate_content"), moderatorController.updateAlbumStatus);
router.put("/users/:id/status", verifyToken, checkPermission("moderate_content"), moderatorController.updateUserStatus);

// Deprecated or legacy endpoints (kept for backward compatibility)
router.get("/dashboard", verifyToken, checkPermission("moderate_content"), moderatorController.getDashboard);
router.put("/songs/:id/moderate", verifyToken, checkPermission("moderate_content"), moderatorController.moderateContent);

module.exports = router;