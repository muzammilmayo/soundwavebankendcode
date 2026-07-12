const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const UserModel = require("../models/userModel");

const { sendResetEmail } = require("../utils/mailer");

const AuthService = {
  register: async ({ username, email, password, role_id }) => {
    const existingUser = await UserModel.findByEmail(email);

    if (existingUser) {
      const error = new Error("Email already exists");
      error.statusCode = 400;
      throw error;
    }

    const hashPassword = await bcrypt.hash(password, 10);
    await UserModel.create({ username, email, hashPassword, role_id });
  },

  login: async ({ email, password }) => {
    const user = await UserModel.findByEmailWithRole(email);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      const error = new Error("Invalid Password");
      error.statusCode = 400;
      throw error;
    }

    if (user.status === "Inactive") {
      const error = new Error("Your account is inactive. Please contact the administrator.");
      error.statusCode = 403;
      throw error;
    }

    const token = jwt.sign(
      { id: user.user_id, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return {
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role_name,
      },
    };
  },

  changePassword: async ({ userId, currentPassword, newPassword }) => {
    const user = await UserModel.findById(userId);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const match = await bcrypt.compare(currentPassword, user.password);

    if (!match) {
      const error = new Error("Current Password is incorrect");
      error.statusCode = 400;
      throw error;
    }

    const hashPassword = await bcrypt.hash(newPassword, 10);
    await UserModel.updatePassword(userId, hashPassword);
  },

  forgotPassword: async (email) => {
    // Attempt to find the user; if DB fails, log and exit gracefully
    let user;
    try {
      user = await UserModel.findByEmail(email);
    } catch (err) {
      console.warn("DB error during forgotPassword (findByEmail):", err.message);
      const error = new Error("Failed to process request.");
      error.statusCode = 500;
      throw error;
    }

    if (!user) {
      const error = new Error("Email not found");
      error.statusCode = 404;
      throw error;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    // Store reset token; if DB fails, log and continue
    try {
      await UserModel.setResetToken(email, token, expiry);
    } catch (err) {
      console.warn("Failed to store reset token:", err.message);
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const resetLink = `${clientUrl}/reset-password/${token}`;
    // send email – errors already handled inside mailer
    await sendResetEmail(email, resetLink);
  },

  // Reset password using a valid reset token
  resetPassword: async ({ token, newPassword }) => {
    const user = await UserModel.findByValidResetToken(token);
    if (!user) {
      const error = new Error('Invalid or Expired Reset Link');
      error.statusCode = 400;
      throw error;
    }
    const hashPassword = await bcrypt.hash(newPassword, 10);
    await UserModel.resetPasswordByToken(token, hashPassword);
  },
};

module.exports = AuthService;
