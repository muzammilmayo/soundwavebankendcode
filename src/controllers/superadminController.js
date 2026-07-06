// superadminController.js
const UserModel = require("../models/userModel");
const bcrypt = require("bcryptjs");

exports.getDashboard = (req, res) => {
  res.json({
    success: true,
    message: "Welcome Super Admin Dashboard"
  });

};

exports.getUsers = async (req, res) => {
  try {
    const users = await UserModel.findAll();
    res.json({
      success: true,
      message: "Manage All Users",
      users
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Database error fetching users"
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
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await UserModel.updateStatus(id, status);
    res.json({
      success: true,
      message: `User account status updated to ${status} successfully`,
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({
      success: false,
      message: "Database error updating user status",
    });
  }
};

exports.updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role_id } = req.body;

  if (!role_id) {
    return res.status(400).json({
      success: false,
      message: "role_id is required",
    });
  }

  try {
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await UserModel.updateRole(id, role_id);
    res.json({
      success: true,
      message: "User role updated successfully",
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({
      success: false,
      message: "Database error updating user role",
    });
  }
};

exports.getSongs = (req, res) => {
  res.json({
    success: true,
    message: "Manage All Songs"
  });
};

exports.uploadSong = (req, res) => {
  res.json({
    success: true,
    message: "Song Uploaded Successfully"
  });
};

exports.editSong = (req, res) => {
  res.json({
    success: true,
    message: "Song Updated Successfully"
  });
};

exports.deleteSong = (req, res) => {
  res.json({
    success: true,
    message: "Song Deleted Successfully"
  });
};

exports.moderateContent = (req, res) => {
  res.json({
    success: true,
    message: "Content Moderated Successfully"
  });
};

exports.playSong = (req, res) => {
  res.json({
    success: true,
    message: "Playing Song"
  });
};

exports.createPlaylist = (req, res) => {
  res.json({
    success: true,
    message: "Playlist Created Successfully"
  });
};

exports.updatePlaylist = (req, res) => {
  res.json({
    success: true,
    message: "Playlist Updated Successfully"
  });
};

exports.createAdmin = async (req, res) => {
  const { username, email, password } = req.body;

  // Validate required fields
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Username, email, and password are required",
    });
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address",
    });
  }

  try {
    // Check if email already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
    }

    // Hash the temporary password
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    // Create the admin user with role_id 2 (Admin)
    const userId = await UserModel.create({
      username,
      email,
      hashPassword,
      role_id: 2, // Admin role
    });

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      user_id: userId,
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({
      success: false,
      message: "Database error creating admin account",
    });
  }
};
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deletion of Super Admin accounts
    if (user.role_id === 1) {
      return res.status(403).json({
        success: false,
        message: "Super Admin accounts cannot be deleted",
      });
    }

    await UserModel.deleteById(id);

    res.json({
      success: true,
      message: `User "${user.username}" has been permanently deleted`,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Database error deleting user",
    });
  }
};
