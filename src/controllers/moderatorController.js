// moderatorController.js

exports.getDashboard = (req, res) => {
  res.json({
    success: true,
    message: "Welcome Moderator Dashboard"
  });
};

exports.moderateContent = (req, res) => {
  res.json({
    success: true,
    message: "Content Moderated Successfully"
  });
};
