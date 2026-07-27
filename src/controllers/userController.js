const UserService = require("../services/userService");
const UserModel = require("../models/userModel");

exports.getProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await UserService.getProfile(userId);

    return res.json({
      success: true,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role_name,
        address: user.address,
        avatar: user.avatar,
        created_at: user.created_at,
        phone: user.phone,
        phone_number: user.phone,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Database error",
    });
  }
};

exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { username, address, avatar, phone, phone_number } = req.body;
  const phoneToSave = phone !== undefined ? phone : phone_number;

  try {
    const oldProfile = await UserModel.findProfileById(userId);
    const oldAvatar = oldProfile ? oldProfile.avatar : null;

    await UserModel.updateProfile(userId, { username, address, avatar, phone: phoneToSave });
    
    if (avatar && avatar !== oldAvatar) {
      const mediaService = require("../services/mediaService");
      await mediaService.deleteFileByUrl(oldAvatar);
    }

    // Fetch updated record
    const updated = await UserModel.findProfileById(userId);

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updated.user_id,
        username: updated.username,
        email: updated.email,
        role: updated.role_name,
        address: updated.address,
        avatar: updated.avatar,
        created_at: updated.created_at,
        phone: updated.phone,
        phone_number: updated.phone,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({
      success: false,
      message: "Database error updating profile",
    });
  }
};
exports.deleteAccount = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Super Admins cannot self-delete
    if (user.role_id === 1) {
      return res.status(403).json({
        success: false,
        message: "Super Admin accounts cannot be self-deleted",
      });
    }

    const avatar = user.avatar;
    await UserModel.deleteById(userId);
    if (avatar) {
      const mediaService = require("../services/mediaService");
      await mediaService.deleteFileByUrl(avatar);
    }

    return res.json({
      success: true,
      message: "Your account has been permanently deleted",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return res.status(500).json({
      success: false,
      message: "Database error deleting account",
    });
  }
};
