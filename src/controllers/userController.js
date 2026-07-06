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
  const { username, address, avatar } = req.body;

  try {
    await UserModel.updateProfile(userId, { username, address, avatar });
    
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
