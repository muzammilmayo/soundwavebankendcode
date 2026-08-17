const { ArtistProfile, ArtistModerator, Song, Album } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { User, Role } = require('../models');
    const userRecord = await User.findByPk(user.id, { include: [Role] });
    if (!userRecord || !userRecord.Role) {
      return res.status(403).json({ success: false, message: "Forbidden: role not found" });
    }

    const roleName = userRecord.Role.role_name;

    if (roleName === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: user.id } });
      if (!profile) {
        return res.status(404).json({ success: false, message: "Artist profile not found" });
      }
      req.user.artistProfileId = profile.artist_profile_id;
      req.user.artistProfile = profile;
      req.user.isArtist = true;
    } else if (roleName === 'Listener') {
      const moderator = await ArtistModerator.findOne({
        where: { user_id: user.id, status: 'active' },
        include: [{ model: ArtistProfile }]
      });

      if (!moderator || !moderator.ArtistProfile) {
        return res.status(403).json({ success: false, message: "Forbidden: You are not assigned as an active moderator for this artist account" });
      }

      req.user.artistProfileId = moderator.artist_id;
      req.user.artistProfile = moderator.ArtistProfile;
      req.user.isArtistModerator = true;
      req.user.moderatedArtistUserId = moderator.ArtistProfile.user_id;
    } else if (roleName === 'Admin' || roleName === 'Super Admin') {
      // Admins can bypass, but they might need a target artist context if specified in body
      if (req.body.artist_profile_id) {
        req.user.artistProfileId = Number(req.body.artist_profile_id);
      }
    } else {
      return res.status(403).json({ success: false, message: "Forbidden: Unauthorized role context" });
    }

    // Resource ownership validation for specific endpoints
    const { id } = req.params;
    if (id) {
      if (req.originalUrl.includes('/songs')) {
        const song = await Song.findByPk(id, { paranoid: false });
        if (song && song.artist_profile_id !== req.user.artistProfileId) {
          return res.status(403).json({ success: false, message: "Forbidden: You do not own or moderate this song resource" });
        }
      } else if (req.originalUrl.includes('/albums')) {
        const album = await Album.findByPk(id, { paranoid: false });
        if (album && album.artist_profile_id !== req.user.artistProfileId) {
          return res.status(403).json({ success: false, message: "Forbidden: You do not own or moderate this album resource" });
        }
      }
    }

    next();
  } catch (err) {
    console.error("Error in artistModeratorMiddleware:", err);
    res.status(500).json({ success: false, message: "Server error during authorization" });
  }
};
