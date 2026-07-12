const { ArtistProfile, User } = require('../models');

// Get artist profile by user ID (assuming user_id foreign key)
exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params; // user id
    const profile = await ArtistProfile.findOne({ where: { user_id: id } });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('Error fetching artist profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create or update (upsert) profile for a user
exports.upsertProfile = async (req, res) => {
  try {
    const { id } = req.params; // user id
    // Verify that the user exists
    const existingUser = await User.findByPk(id);
    if (!existingUser) {
      return res.status(400).json({ success: false, message: 'User does not exist' });
    }
    const profileData = { ...req.body, user_id: id };

    // If files were uploaded via multipart/form-data, extract filenames and construct URLs
    if (req.files) {
      if (req.files.profile_image && req.files.profile_image[0]) {
        profileData.profile_image = `http://localhost:5000/uploads/${req.files.profile_image[0].filename}`;
      }
      if (req.files.cover_image && req.files.cover_image[0]) {
        profileData.cover_image = `http://localhost:5000/uploads/${req.files.cover_image[0].filename}`;
      }
    }

    const [profile, created] = await ArtistProfile.upsert(profileData, { returning: true });
    res.status(201).json({
      success: true,
      message: created ? 'Profile created' : 'Profile updated',
      data: profile,
    });
  } catch (error) {
    console.error('Error upserting artist profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete profile
exports.deleteProfile = async (req, res) => {
  try {
    const { id } = req.params; // user id
    const rows = await ArtistProfile.destroy({ where: { user_id: id } });
    if (!rows) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.status(200).json({ success: true, message: 'Profile deleted' });
  } catch (error) {
    console.error('Error deleting artist profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
