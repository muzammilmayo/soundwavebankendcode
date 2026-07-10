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
    if (!req.file) return res.status(400).json({ success: false, message: 'Audio file required' });
    const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
    const songData = {
      artist_profile_id: profile.artist_profile_id,
      audio_file: req.file.filename,
      ...req.body,
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
    await profile.update(req.body);
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