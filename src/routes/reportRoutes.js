const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const reportController = require("../controllers/reportController");

// Helper middleware to resolve artist moderator context if available without blocking standard listeners
const resolveModeratorContext = async (req, res, next) => {
  try {
    const { User, Role, ArtistModerator, ArtistProfile } = require("../models");
    const userRecord = await User.findByPk(req.user.id, { include: [Role] });
    if (userRecord && userRecord.Role) {
      const roleName = userRecord.Role.role_name;
      if (roleName === "Artist") {
        const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
        if (profile) {
          req.user.artistProfileId = profile.artist_profile_id;
          req.user.artistProfile = profile;
          req.user.isArtist = true;
        }
      } else if (roleName === "Listener") {
        const moderator = await ArtistModerator.findOne({
          where: { user_id: req.user.id, status: "active" },
          include: [{ model: ArtistProfile }]
        });
        if (moderator && moderator.ArtistProfile) {
          req.user.artistProfileId = moderator.artist_id;
          req.user.artistProfile = moderator.ArtistProfile;
          req.user.isArtistModerator = true;
          req.user.moderatedArtistUserId = moderator.ArtistProfile.user_id;
        }
      }
    }
    next();
  } catch (err) {
    console.error("Error resolving moderator context:", err);
    next();
  }
};

// All report routes require verification
router.use(verifyToken);

// 1. File a new report
router.post("/", reportController.createReport);

// 2. Fetch scoped reports
router.get("/", resolveModeratorContext, reportController.getReports);

// 3. Get detailed report
router.get("/:id", reportController.getReportDetails);

// 4. Update status/assignment
router.put("/:id/status", reportController.updateReportStatus);

// 5. Execute moderation action
router.post("/:id/action", reportController.takeReportAction);

module.exports = router;
