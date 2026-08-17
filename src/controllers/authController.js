const AuthService = require("../services/authService");

// =========================
// Register
// =========================

exports.register = async (req, res) => {
  console.log("BODY:", req.body);

  const { username, email, password, role_id } = req.body;

  if (!username || !email || !password || !role_id) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    await AuthService.register({ username, email, password, role_id });

    res.status(201).json({
      success: true,
      message: "User Registered Successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// Login
// =========================
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { token, user } = await AuthService.login({ email, password });
    // Store the token for revocation
    
    // Set HttpOnly cookie for authentication
    res.cookie('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });
    res.status(200).json({
      success: true,
      message: "Login Successful",
      token,
      user,
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// Change Password
// =========================
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    await AuthService.changePassword({ userId, currentPassword, newPassword });

    res.json({
      success: true,
      message: "Password Changed Successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// Forgot Password
// =========================
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    await AuthService.forgotPassword(email);

    res.json({
      success: true,
      message: "Reset password link sent to your email.",
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to send email.",
    });
  }
};

// =========================
// Reset Password
// =========================
exports.resetPassword = async (req, res) => {
  const token = req.params.token || req.body.token;
  const { newPassword } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "Reset token is required (provide it in URL or request body).",
    });
  }

  try {
    await AuthService.resetPassword({ token, newPassword });
    res.json({
      success: true,
      message: "Password Reset Successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// Logout
// =========================
exports.logout = (req, res) => {
  // Clear the authentication cookie
  res.clearCookie('auth_token');
  res.status(200).json({
    success: true,
    message: "Logout Successfully",
  });
};
