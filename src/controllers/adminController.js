const UserModel = require("../models/userModel");
const { ArtistProfile } = require("../models");

exports.getDashboard = (req, res) => {
  res.json({
    success: true,
    message: "Welcome Admin Dashboard",
  });
};

exports.getUsers = async (req, res) => {
  try {
    const allUsers = await UserModel.findAll();
    // Filter out Super Admins
    const filtered = allUsers.filter((u) => u.role_name !== "Super Admin");
    res.json({
      success: true,
      users: filtered,
    });
  } catch (error) {
    console.error("Error fetching users for admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || (status !== "Active" && status !== "Inactive")) {
    return res.status(400).json({
      success: false,
      message: "Valid status ('Active' or 'Inactive') is required",
    });
  }

  try {
    const targetUser = await UserModel.findProfileById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Security Constraint: Admins cannot activate/deactivate Super Admin accounts
    if (targetUser.role_name === "Super Admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admins cannot modify Super Admin account status",
      });
    }

    await UserModel.updateStatus(id, status);
    res.json({
      success: true,
      message: `User account status updated to ${status} successfully`,
    });
  } catch (error) {
    console.error("Error updating user status by admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};

exports.getSongs = (req, res) => {
  res.json({
    success: true,
    message: "All Songs",
  });
};

exports.deleteSong = (req, res) => {
  res.json({
    success: true,
    message: "Song Deleted Successfully",
  });
};

exports.moderateContent = (req, res) => {
  res.json({
    success: true,
    message: "Content Moderated Successfully",
  });
};

exports.toggleArtistVerification = async (req, res) => {
  const { id } = req.params;
  try {
    const profile = await ArtistProfile.findOne({ where: { user_id: id } });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Artist profile not found" });
    }
    const newVerificationStatus = !profile.is_verified;
    await profile.update({ is_verified: newVerificationStatus });
    res.json({
      success: true,
      message: `Artist verification status updated to ${newVerificationStatus ? 'Verified' : 'Unverified'} successfully`,
      is_verified: newVerificationStatus
    });
  } catch (error) {
    console.error("Error toggling artist verification status:", error);
    res.status(500).json({ success: false, message: "Failed to toggle verification status" });
  }
};
