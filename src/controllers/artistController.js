// artistController.js

exports.getDashboard = (req, res) => {
  res.json({
    success: true,
    message: "Welcome Artist Dashboard"
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
