// artistController.js

exports.getDashboard = (req, res) => {
  res.json({
    success: true,
    message: "Welcome Artist Dashboard"
  });
};

const { Song, ArtistProfile, SongLike, ArtistFollower, Notification } = require('../models');

exports.uploadSong = async (req, res) => {
  try {
    const audioFile = req.files && req.files['audio'] ? req.files['audio'][0] : null;
    const coverImageFile = req.files && req.files['cover_image'] ? req.files['cover_image'][0] : null;

    if (!audioFile) return res.status(400).json({ success: false, message: 'Audio file required' });
    const targetUserId = req.user.moderatedArtistUserId || req.user.id;
    const profile = await ArtistProfile.findOne({ where: { user_id: targetUserId } });
    if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
    
    let cover_image = req.body.cover_image || null;
    if (coverImageFile) {
      const mediaService = require('../services/mediaService');
      cover_image = mediaService.getFileUrl(coverImageFile.filename);
    }

    let status = req.body.status || 'draft';
    if (req.body.is_published !== undefined) {
      status = req.body.is_published ? 'published' : 'draft';
    }

    const songData = {
      artist_profile_id: profile.artist_profile_id,
      audio_file: audioFile.filename,
      title: req.body.title,
      description: req.body.description,
      duration: req.body.duration || 0,
      category_id: req.body.category_id || null,
      album_id: req.body.album_id || null,
      cover_image: cover_image,
      status: status,
      scheduled_for: req.body.scheduled_for || null
    };
    const song = await Song.create(songData);

    // ── Queue lyrics generation (fire-and-forget, non-blocking) ──────────────
    try {
      const { lyricsQueue } = require('../queues/lyricsQueue');
      const lyricsJob = await lyricsQueue.add('generate-lyrics', { songId: song.song_id });
      await song.update({ lyrics_status: 'pending', lyrics_job_id: String(lyricsJob.id) });
      console.log(`[artistController] Lyrics job queued: song=${song.song_id}, job=${lyricsJob.id}`);
    } catch (queueErr) {
      // Don't fail the upload if Redis/queue is unavailable — lyrics are optional
      console.warn('[artistController] Could not queue lyrics job:', queueErr.message);
    }

    // Notify all followers if published immediately

    if (status === 'published') {
      const followers = await ArtistFollower.findAll({
        where: { artist_profile_id: profile.artist_profile_id }
      });

      if (followers.length > 0) {
        const notificationsToCreate = followers.map(f => ({
          id: "notif_song_" + song.song_id + "_" + f.user_id + "_" + Date.now(),
          user_id: f.user_id,
          type: "song",
          target_id: song.song_id,
          title: "New Song Uploaded!",
          message: `${profile.stage_name || "Followed Artist"} uploaded a new song: "${song.title}"`,
          timestamp: new Date().toISOString(),
          read: false,
          cleared: false
        }));
        await Notification.bulkCreate(notificationsToCreate);
      }
    }

    res.json({ success: true, message: 'Song uploaded', data: song });
  } catch (err) {
    console.error(err);
    const mediaService = require('../services/mediaService');
    if (audioFile) {
      await mediaService.deleteFileByUrl(audioFile.filename);
    }
    if (coverImageFile) {
      await mediaService.deleteFileByUrl(coverImageFile.filename);
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.editSong = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUserId = req.user.moderatedArtistUserId || req.user.id;
    const profile = await ArtistProfile.findOne({ where: { user_id: targetUserId } });
    if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });

    const song = await Song.findOne({ where: { song_id: id, artist_profile_id: profile.artist_profile_id } });
    if (!song) return res.status(404).json({ success: false, message: 'Song not found or unauthorized' });

    if (song.status === 'moderated') {
      return res.status(403).json({ success: false, message: 'This song has been moderated and cannot be edited or updated.' });
    }

    const updateData = { ...req.body };
    
    if (updateData.is_published !== undefined) {
      updateData.status = updateData.is_published ? 'published' : 'draft';
      delete updateData.is_published;
    }

    if (updateData.status && !['draft', 'published', 'archived'].includes(updateData.status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value. Allowed: draft, published, archived' });
    }

    const oldAudio = song.audio_file;
    const oldCover = song.cover_image;
    await song.update(updateData);
    const mediaService = require('../services/mediaService');
    if (updateData.audio_file && updateData.audio_file !== oldAudio) {
      await mediaService.deleteFileByUrl(oldAudio);
    }
    if (updateData.cover_image && updateData.cover_image !== oldCover) {
      await mediaService.deleteFileByUrl(oldCover);
    }

    res.json({
      success: true,
      message: "Song Updated Successfully",
      data: song
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// New profile & catalog functions
exports.getProfile = async (req, res) => {
  try {
    const targetUserId = req.user.moderatedArtistUserId || req.user.id;
    const profile = await ArtistProfile.findOne({ where: { user_id: targetUserId } });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    
    // Destructure allowed update fields to strip out is_verified
    const { stage_name, bio, profile_image, cover_image, facebook, instagram, youtube, spotify } = req.body;
    
    const oldProfileImage = profile.profile_image;
    const oldCoverImage = profile.cover_image;

    await profile.update({ stage_name, bio, profile_image, cover_image, facebook, instagram, youtube, spotify });
    
    const mediaService = require('../services/mediaService');
    if (profile_image && profile_image !== oldProfileImage) {
      await mediaService.deleteFileByUrl(oldProfileImage);
    }
    if (cover_image && cover_image !== oldCoverImage) {
      await mediaService.deleteFileByUrl(oldCoverImage);
    }

    res.json({ success: true, message: 'Profile updated', data: profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAlbums = async (req, res) => {
  try {
    const targetUserId = req.user.moderatedArtistUserId || req.user.id;
    const profile = await ArtistProfile.findOne({ where: { user_id: targetUserId } });
    if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
    const albums = await profile.getAlbums();
    res.json({ success: true, data: albums });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const { Sequelize } = require('sequelize');

exports.getSongs = async (req, res) => {
  try {
    const targetUserId = req.user.moderatedArtistUserId || req.user.id;
    const profile = await ArtistProfile.findOne({ where: { user_id: targetUserId } });
    if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
    
    const likesCountCol = [
      Sequelize.literal(`(
        SELECT COUNT(*)
        FROM song_likes AS likes
        WHERE likes.song_id = Song.song_id
      )`),
      'likes_count'
    ];

    const songs = await Song.findAll({
      where: { artist_profile_id: profile.artist_profile_id },
      attributes: { include: [likesCountCol] },
      include: [
        {
          model: SongLike
        }
      ]
    });
    res.json({ success: true, data: songs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const { ArtistProfile, Song, SongLike, ArtistFollower, Feedback } = require("../models");

    // 1. Get the artist's profile
    const targetUserId = req.user.moderatedArtistUserId || req.user.id;
    const profile = await ArtistProfile.findOne({ where: { user_id: targetUserId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Artist profile not found" });
    }

    const artistId = profile.artist_profile_id;

    // 2. Get all songs belonging to this artist
    const songs = await Song.findAll({ where: { artist_profile_id: artistId } });
    const songIds = songs.map(s => s.song_id);

    // Calculate total plays
    const totalPlays = songs.reduce((acc, song) => acc + (song.play_count || 0), 0);

    // Calculate total likes
    const totalLikes = await SongLike.count({ where: { song_id: songIds } });

    // Calculate total followers
    const totalFollowers = await ArtistFollower.count({ where: { artist_profile_id: artistId } });

    // 3. Leaderboard - top songs (max 5)
    const topSongs = songs
      .map(s => ({
        song_id: s.song_id,
        title: s.title,
        play_count: s.play_count || 0,
        status: s.status,
        cover_image: s.cover_image,
        created_at: s.created_at
      }))
      .sort((a, b) => b.play_count - a.play_count)
      .slice(0, 5);

    // 4. Feedbacks & reviews stats
    const feedbacks = await Feedback.findAll({ where: { song_id: songIds } });
    const totalReviews = feedbacks.length;
    const averageRating = totalReviews > 0
      ? Number((feedbacks.reduce((acc, f) => acc + f.rating, 0) / totalReviews).toFixed(1))
      : 0;

    const ratingDistribution = [0, 0, 0, 0, 0]; // Index 0: 1 star, Index 4: 5 stars
    feedbacks.forEach(f => {
      const ratingIndex = Math.min(Math.max(f.rating - 1, 0), 4);
      ratingDistribution[ratingIndex]++;
    });

    // 5. Recent interaction logs / activity stream (max 10)
    const { InteractionLog, User } = require("../models");
    let recentLogs = [];
    if (songIds.length > 0) {
      const logs = await InteractionLog.findAll({
        where: {
          target_type: "song",
          target_id: songIds.map(String)
        },
        include: [{ model: User, attributes: ["username"] }],
        order: [["timestamp", "DESC"]],
        limit: 10
      });

      recentLogs = logs.map(log => {
        const item = log.toJSON();
        const username = log.User ? log.User.username : "Someone";
        const songName = songs.find(s => String(s.song_id) === log.target_id)?.title || `Song #${log.target_id}`;

        let description = "";
        if (log.interaction_type === "play") {
          description = `${username} played "${songName}"`;
        } else if (log.interaction_type === "like") {
          description = `${username} liked "${songName}"`;
        } else if (log.interaction_type === "unlike") {
          description = `${username} unliked "${songName}"`;
        } else if (log.interaction_type === "add_to_playlist") {
          description = `${username} added "${songName}" to a playlist`;
        } else {
          description = `${username} interacted with "${songName}" (${log.interaction_type})`;
        }

        return {
          log_id: log.log_id,
          interaction_type: log.interaction_type,
          created_at: log.timestamp,
          description
        };
      });
    }

    res.json({
      success: true,
      data: {
        stats: {
          totalPlays,
          totalLikes,
          totalFollowers,
          totalReviews
        },
        topSongs,
        reviews: {
          total: totalReviews,
          average: averageRating,
          distribution: ratingDistribution
        },
        recentActivity: recentLogs
      }
    });
  } catch (err) {
    console.error("Error fetching artist analytics:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getFollowers = async (req, res) => {
  try {
    const { ArtistProfile, ArtistFollower, User } = require("../models");
    const targetUserId = req.user.moderatedArtistUserId || req.user.id;
    const profile = await ArtistProfile.findOne({ where: { user_id: targetUserId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Artist profile not found" });
    }

    const followers = await ArtistFollower.findAll({
      where: { artist_profile_id: profile.artist_profile_id },
      include: [{ model: User, attributes: ["user_id", "username", "email"] }]
    });

    const formatted = followers.map(f => ({
      id: f.User ? f.User.user_id : f.user_id,
      username: f.User ? f.User.username : "Anonymous Listener",
      email: f.User ? f.User.email : "N/A"
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error("Error fetching artist followers:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.assignModerator = async (req, res) => {
  try {
    if (req.user.isArtistModerator) {
      return res.status(403).json({ success: false, message: "Forbidden: Moderators cannot assign other moderators" });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const { User, Role, ArtistModerator } = require("../models");
    const userToAssign = await User.findOne({ where: { email }, include: [Role] });

    if (!userToAssign) return res.status(404).json({ success: false, message: "Listener user not found" });
    if (userToAssign.Role?.role_name !== "Listener") {
      return res.status(400).json({ success: false, message: "Only users with the Listener role can be assigned as moderators" });
    }

    // Check if duplicate assignment for this artist
    const existing = await ArtistModerator.findOne({
      where: {
        artist_id: req.user.artistProfileId,
        user_id: userToAssign.user_id
      }
    });

    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({ success: false, message: "This user is already a moderator for your account" });
      } else {
        // Reactivate
        await existing.update({ status: 'active' });
        return res.json({ success: true, message: "Moderator assigned successfully", data: existing });
      }
    }

    const newMod = await ArtistModerator.create({
      artist_id: req.user.artistProfileId,
      user_id: userToAssign.user_id,
      status: "active"
    });

    res.status(201).json({ success: true, message: "Moderator assigned successfully", data: newMod });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listModerators = async (req, res) => {
  try {
    const { ArtistModerator, User } = require("../models");
    const moderators = await ArtistModerator.findAll({
      where: {
        artist_id: req.user.artistProfileId,
        status: "active"
      },
      include: [{ model: User, attributes: ["user_id", "username", "email"] }]
    });

    const formatted = moderators.map(m => ({
      id: m.id,
      user_id: m.User ? m.User.user_id : m.user_id,
      username: m.User ? m.User.username : "N/A",
      email: m.User ? m.User.email : "N/A",
      status: m.status
    }));

    res.json({ success: true, moderators: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.removeModerator = async (req, res) => {
  try {
    if (req.user.isArtistModerator) {
      return res.status(403).json({ success: false, message: "Forbidden: Moderators cannot remove moderators" });
    }

    const { id } = req.params;
    const { ArtistModerator } = require("../models");
    const moderator = await ArtistModerator.findOne({
      where: {
        id,
        artist_id: req.user.artistProfileId
      }
    });

    if (!moderator) return res.status(404).json({ success: false, message: "Moderator assignment not found" });

    await moderator.destroy();
    res.json({ success: true, message: "Moderator removed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.searchListeners = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const { User, Role } = require("../models");
    const { Op } = require("sequelize");

    const listenerRole = await Role.findOne({ where: { role_name: "Listener" } });
    if (!listenerRole) return res.status(404).json({ success: false, message: "Listener role not configured" });

    const listeners = await User.findAll({
      where: {
        role_id: listenerRole.role_id,
        status: "Active",
        [Op.or]: [
          { username: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } }
        ]
      },
      attributes: ["user_id", "username", "email"],
      limit: 10
    });

    res.json({ success: true, listeners });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};