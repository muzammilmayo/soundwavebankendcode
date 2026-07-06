// listenerController.js

exports.getDashboard = (req, res) => {
  res.json({
    success: true,
    message: "Welcome Listener Dashboard"
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
