// artistController.js

exports.getDashboard = (req, res) => {
  res.json({
    success: true,
    message: "Welcome Artist Dashboard"
  });
};

const { Song, ArtistProfile } = require('../models');

exports.uploadSong = async (req, res) => {
  try {
    const audioFile = req.files && req.files['audio'] ? req.files['audio'][0] : null;
    const coverImageFile = req.files && req.files['cover_image'] ? req.files['cover_image'][0] : null;

    if (!audioFile) return res.status(400).json({ success: false, message: 'Audio file required' });
    const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
    
    let cover_image = req.body.cover_image || null;
    if (coverImageFile) {
      const mediaService = require('../services/mediaService');
      cover_image = mediaService.getFileUrl(coverImageFile.filename);
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
      is_published: req.body.is_published !== undefined ? req.body.is_published : true,
    };
    const song = await Song.create(songData);
    res.json({ success: true, message: 'Song uploaded', data: song });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.editSong = (req, res) => {
  res.json({
    success: true,
    message: "Song Updated Successfully"
  });
};

// New profile & catalog functions
exports.getProfile = async (req, res) => {
  try {
    const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
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
    await profile.update({ stage_name, bio, profile_image, cover_image, facebook, instagram, youtube, spotify });
    
    res.json({ success: true, message: 'Profile updated', data: profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAlbums = async (req, res) => {
  try {
    const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
    const albums = await profile.getAlbums();
    res.json({ success: true, data: albums });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getSongs = async (req, res) => {
  try {
    const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
    const songs = await profile.getSongs();
    res.json({ success: true, data: songs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};