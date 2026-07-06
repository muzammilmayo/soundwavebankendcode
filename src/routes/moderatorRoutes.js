const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permission.Middleware");
const moderatorController = require("../controllers/moderatorController");

// Moderator Dashboard
router.get(
  "/dashboard",
  verifyToken,
  checkPermission("moderate_content"),
  moderatorController.getDashboard
);

// Moderate Content
router.put(
  "/songs/:id/moderate",
  verifyToken,
  checkPermission("moderate_content"),
  moderatorController.moderateContent
);

module.exports = router;