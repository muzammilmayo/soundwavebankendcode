// backend/src/controllers/catalogController.js

const { ArtistProfile, Album, Song, Category, User, Role } = require("../models");
const { Op } = require("sequelize");

/** ---------------------------------------------------------------
 * PUBLIC ENDPOINTS – accessible to any logged‑in user (or even unauth).
 * --------------------------------------------------------------- */
exports.browseArtists = async (req, res) => {
  try {
    const artists = await ArtistProfile.findAll({
      attributes: { exclude: ["created_at", "updated_at"] },
      include: [{ model: User, attributes: ["username", "email"] }],
    });
    res.json({ success: true, artists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.browseAlbums = async (req, res) => {
  try {
    const albums = await Album.findAll({
      where: { is_published: true },
      include: [{ model: ArtistProfile, attributes: ["stage_name"] }],
    });
    res.json({ success: true, albums });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.browseSongs = async (req, res) => {
  try {
    const songs = await Song.findAll({
      where: { is_published: true },
      include: [
        { model: ArtistProfile, attributes: ["stage_name"] },
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
    const { title, description, cover_image, release_date } = req.body;
    const album = await Album.create({ 
      artist_profile_id: artistProfileId, 
      title, 
      description, 
      cover_image, 
      release_date,
      is_published: true 
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

    const role = await Role.findByPk(req.user.role_id);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || album.artist_profile_id !== profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot modify another artist's album" });
      }
    }

    await album.update(req.body);
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

    const role = await Role.findByPk(req.user.role_id);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || album.artist_profile_id !== profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete another artist's album" });
      }
    }

    await album.destroy();
    res.json({ success: true, message: "Album deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSong = async (req, res) => {
  try {
    const role = await Role.findByPk(req.user.role_id);
    let artistProfileId = req.body.artist_profile_id;
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile) return res.status(404).json({ success: false, message: "Artist profile not found" });
      artistProfileId = profile.artist_profile_id;
    }
    const songData = { ...req.body, artist_profile_id: artistProfileId };
    const song = await Song.create(songData);
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

    const role = await Role.findByPk(req.user.role_id);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id !== profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot modify another artist's song" });
      }
    }

    await song.update(req.body);
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

    const role = await Role.findByPk(req.user.role_id);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id !== profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete another artist's song" });
      }
    }

    await song.destroy();
    res.json({ success: true, message: "Song deleted" });
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
};
