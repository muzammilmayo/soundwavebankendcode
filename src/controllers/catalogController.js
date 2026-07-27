// backend/src/controllers/catalogController.js

const { ArtistProfile, Album, Song, Category, User, Role, Feedback, ArtistFollower, Notification } = require("../models");
const { Op } = require("sequelize");
const mediaService = require("../services/mediaService");

/** ---------------------------------------------------------------
 * PUBLIC ENDPOINTS – accessible to any logged‑in user (or even unauth).
 * --------------------------------------------------------------- */
exports.browseArtists = async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { stage_name: { [Op.like]: `%${search}%` } },
        { bio: { [Op.like]: `%${search}%` } }
      ];
    }
    const artists = await ArtistProfile.findAll({
      where: whereClause,
      attributes: { exclude: ["created_at", "updated_at"] },
      include: [{ model: User, attributes: ["username", "email"], where: { status: "Active" } }],
    });
    res.json({ success: true, artists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.browseAlbums = async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = { status: 'published' };
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { "$ArtistProfile.stage_name$": { [Op.like]: `%${search}%` } }
      ];
    }
    const albums = await Album.findAll({
      where: whereClause,
      include: [
        { 
          model: ArtistProfile, 
          attributes: ["stage_name"],
          include: [{ model: User, attributes: [], where: { status: "Active" } }]
        }
      ],
    });
    res.json({ success: true, albums });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.browseSongs = async (req, res) => {
  try {
    const { search, category } = req.query;
    const whereClause = { status: 'published' };

    if (category) {
      whereClause.category_id = category;
    }

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { "$ArtistProfile.stage_name$": { [Op.like]: `%${search}%` } }
      ];

      // Log search interaction in background (non-blocking)
      const { InteractionLog } = require('../models');
      InteractionLog.create({
        user_id: req.user ? req.user.id : null,
        interaction_type: "search",
        target_type: "none",
        target_id: null,
        details: search
      }).catch(err => console.error("[CatalogController] Error logging search:", err));
    }

    const songs = await Song.findAll({
      where: whereClause,
      include: [
        { 
          model: ArtistProfile, 
          attributes: ["stage_name"],
          include: [{ model: User, attributes: [], where: { status: "Active" } }]
        },
        { model: Album, attributes: ["title"] },
        { model: Category, attributes: ["name"] },
      ],
    });
    res.json({ success: true, songs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.browseCategories = async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.json({ success: true, categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** ---------------------------------------------------------------
 * ADMIN/ARTIST ENDPOINTS – guarded by permissionMiddleware
 * --------------------------------------------------------------- */
exports.createAlbum = async (req, res) => {
  try {
    const role = await Role.findByPk(req.user.role_id);
    let artistProfileId = req.body.artist_profile_id;
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile) return res.status(404).json({ success: false, message: "Artist profile not found" });
      artistProfileId = profile.artist_profile_id;
    }
    const { title, description, release_date, status, scheduled_for } = req.body;
    let cover_image = req.body.cover_image;
    if (req.file) {
      cover_image = mediaService.getFileUrl(req.file.filename);
    }

    let computedStatus = status || 'draft';
    if (req.body.is_published !== undefined) computedStatus = req.body.is_published ? 'published' : 'draft';

    const album = await Album.create({ 
      artist_profile_id: artistProfileId, 
      title, 
      description, 
      cover_image, 
      release_date,
      status: computedStatus,
      scheduled_for: scheduled_for || null
    });
    res.status(201).json({ success: true, album });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const album = await Album.findByPk(id);
    if (!album) return res.status(404).json({ success: false, message: "Album not found" });

    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || album.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot modify another artist's album" });
      }
    }

    const { title, description, release_date, status, scheduled_for } = req.body;
    let cover_image = req.body.cover_image;
    if (req.file) {
      cover_image = mediaService.getFileUrl(req.file.filename);
    }

    const updateData = { title, description, release_date };
    if (status !== undefined) updateData.status = status;
    if (scheduled_for !== undefined) updateData.scheduled_for = scheduled_for;
    if (req.body.is_published !== undefined) updateData.status = req.body.is_published ? 'published' : 'draft';
    if (cover_image !== undefined) {
      updateData.cover_image = cover_image;
    }

    const oldCover = album.cover_image;
    await album.update(updateData);
    if (updateData.cover_image && updateData.cover_image !== oldCover) {
      await mediaService.deleteFileByUrl(oldCover);
    }
    res.json({ success: true, album });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const album = await Album.findByPk(id);
    if (!album) return res.status(404).json({ success: false, message: "Album not found" });

    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || album.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete another artist's album" });
      }
    }

    const coverImage = album.cover_image;
    await album.destroy();
    if (coverImage) {
      await mediaService.deleteFileByUrl(coverImage);
    }
    res.json({ success: true, message: "Album deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSong = async (req, res) => {
  try {
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    let artistProfileId = req.body.artist_profile_id;
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile) return res.status(404).json({ success: false, message: "Artist profile not found" });
      artistProfileId = profile.artist_profile_id;
    }
    const songData = { ...req.body, artist_profile_id: artistProfileId };
    if (!songData.status) songData.status = 'draft';
    if (songData.is_published !== undefined) {
      songData.status = songData.is_published ? 'published' : 'draft';
      delete songData.is_published;
    }
    const song = await Song.create(songData);

    // Notify all followers
    if (artistProfileId) {
      const profile = await ArtistProfile.findByPk(artistProfileId);
      const followers = await ArtistFollower.findAll({
        where: { artist_profile_id: artistProfileId }
      });

      if (followers.length > 0) {
        const notificationsToCreate = followers.map(f => ({
          id: "notif_song_" + song.song_id + "_" + f.user_id + "_" + Date.now(),
          user_id: f.user_id,
          type: "song",
          target_id: song.song_id,
          title: "New Song Uploaded!",
          message: `${profile?.stage_name || "Followed Artist"} uploaded a new song: "${song.title}"`,
          timestamp: new Date().toISOString(),
          read: false,
          cleared: false
        }));
        await Notification.bulkCreate(notificationsToCreate);
      }
    }

    res.status(201).json({ success: true, song });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: "Song not found" });

    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot modify another artist's song" });
      }
    }

    const updateData = { ...req.body };
    if (updateData.is_published !== undefined) {
      updateData.status = updateData.is_published ? 'published' : 'draft';
      delete updateData.is_published;
    }
    const oldAudio = song.audio_file;
    const oldCover = song.cover_image;
    await song.update(updateData);
    if (updateData.audio_file && updateData.audio_file !== oldAudio) {
      await mediaService.deleteFileByUrl(oldAudio);
    }
    if (updateData.cover_image && updateData.cover_image !== oldCover) {
      await mediaService.deleteFileByUrl(oldCover);
    }
    res.json({ success: true, song });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: "Song not found" });

    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete another artist's song" });
      }
    }

    const audioFile = song.audio_file;
    const coverImage = song.cover_image;
    await song.destroy();
    if (audioFile) {
      await mediaService.deleteFileByUrl(audioFile);
    }
    if (coverImage) {
      await mediaService.deleteFileByUrl(coverImage);
    }
    res.json({ success: true, message: "Song deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Draft Songs Endpoints

/** List Draft Songs for the authenticated artist */
exports.listDraftSongs = async (req, res) => {
  try {
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    let whereClause = { status: 'draft' };
    if (role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
      whereClause.artist_profile_id = profile.artist_profile_id;
    }
    const drafts = await Song.findAll({ where: whereClause, include: [{ model: Album, attributes: ['title'] }, { model: Category, attributes: ['name'] }] });
    res.json({ success: true, drafts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Create a draft song */
exports.createDraftSong = async (req, res) => {
  try {
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    let artistProfileId = req.body.artist_profile_id;
    if (role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
      artistProfileId = profile.artist_profile_id;
    }
    const songData = { ...req.body, artist_profile_id: artistProfileId, status: 'draft' };
    const song = await Song.create(songData);
    res.status(201).json({ success: true, song });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Update a draft song */
exports.updateDraftSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    if (song.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft songs can be updated via this endpoint' });
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot modify another artist's draft song" });
      }
    }
    const updateData = { ...req.body };
    await song.update(updateData);
    res.json({ success: true, song });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Delete a draft song */
exports.deleteDraftSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    if (song.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft songs can be deleted via this endpoint' });
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete another artist's draft song" });
      }
    }
    await song.destroy();
    res.json({ success: true, message: 'Draft song deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Publish a draft song */
exports.publishDraftSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    if (song.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft songs can be published via this endpoint' });
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot publish another artist's draft song" });
      }
    }
    await song.update({ status: 'published', scheduled_for: null });
    res.json({ success: true, song });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json({ success: true, category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await Category.update(req.body, { where: { category_id: id } });
    if (rows === 0) return res.status(404).json({ success: false, message: "Category not found" });
    const category = await Category.findByPk(id);
    res.json({ success: true, category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await Category.destroy({ where: { category_id: id } });
    if (!rows) return res.status(404).json({ success: false, message: "Category not found" });
    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.findAll({
      include: [
        {
          model: Song,
          attributes: ["title", "cover_image"]
        }
      ]
    });
    const formatted = feedbacks.map(f => {
      const json = f.toJSON();
      json.song_title = f.Song ? f.Song.title : "";
      return json;
    });
    res.json({ success: true, feedbacks: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    const { id, song_id, rating, comment } = req.body;
    const user = await User.findByPk(req.user.id);
    const username = user ? user.username : "Anonymous Listener";
    
    const feedback = await Feedback.create({
      id: id || ("feed_" + Date.now()),
      song_id,
      user_id: req.user.id,
      username,
      rating,
      comment,
      timestamp: new Date().toISOString(),
      edited: false,
      likes: 0,
      liked_by: []
    });
    
    const songObj = await Song.findByPk(song_id);
    const formatted = feedback.toJSON();
    formatted.song_title = songObj ? songObj.title : "";

    res.status(201).json({ success: true, feedback: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const feedback = await Feedback.findByPk(id);
    if (!feedback) return res.status(404).json({ success: false, message: "Feedback not found" });

    if (feedback.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await feedback.update({
      rating,
      comment,
      edited: true,
    });

    const songObj = await Song.findByPk(feedback.song_id);
    const formatted = feedback.toJSON();
    formatted.song_title = songObj ? songObj.title : "";

    res.json({ success: true, feedback: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findByPk(id);
    if (!feedback) return res.status(404).json({ success: false, message: "Feedback not found" });

    if (feedback.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await feedback.destroy();
    res.json({ success: true, message: "Feedback deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleLikeFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findByPk(id);
    if (!feedback) return res.status(404).json({ success: false, message: "Feedback not found" });

    const userId = req.user.id;
    let likedBy = feedback.liked_by || [];
    const index = likedBy.indexOf(userId);
    if (index === -1) {
      likedBy.push(userId);
    } else {
      likedBy.splice(index, 1);
    }

    await feedback.update({
      liked_by: likedBy,
      likes: likedBy.length
    });

    res.json({ success: true, likes: feedback.likes, likedBy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  // public
  browseArtists: exports.browseArtists,
  browseAlbums: exports.browseAlbums,
  browseSongs: exports.browseSongs,
  browseCategories: exports.browseCategories,
  // admin
  createAlbum: exports.createAlbum,
  updateAlbum: exports.updateAlbum,
  deleteAlbum: exports.deleteAlbum,
  createSong: exports.createSong,
  updateSong: exports.updateSong,
  deleteSong: exports.deleteSong,
  createCategory: exports.createCategory,
  updateCategory: exports.updateCategory,
  deleteCategory: exports.deleteCategory,
  // feedback
  getFeedbacks: exports.getFeedbacks,
  submitFeedback: exports.submitFeedback,
  updateFeedback: exports.updateFeedback,
  deleteFeedback: exports.deleteFeedback,
  toggleLikeFeedback: exports.toggleLikeFeedback,
  // Draft song endpoints
  listDraftSongs: exports.listDraftSongs,
  createDraftSong: exports.createDraftSong,
  updateDraftSong: exports.updateDraftSong,
  deleteDraftSong: exports.deleteDraftSong,
  publishDraftSong: exports.publishDraftSong,
};
