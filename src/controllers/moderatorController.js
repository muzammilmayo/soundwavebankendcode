const { Song, Album, User, Report, ArtistProfile, Category, Role } = require("../models");

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

// Create a Report
exports.createReport = async (req, res) => {
  try {
    const { target_type, target_id, reason } = req.body;
    if (!target_type || !target_id || !reason) {
      return res.status(400).json({ success: false, message: "target_type, target_id, and reason are required" });
    }

    const report = await Report.create({
      user_id: req.user.id,
      target_type,
      target_id,
      reason,
      status: "pending"
    });

    res.status(201).json({ success: true, message: "Report submitted successfully", report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all reports
exports.getReports = async (req, res) => {
  try {
    const reports = await Report.findAll({
      include: [
        { model: User, attributes: ["username", "email"] }
      ],
      order: [["created_at", "DESC"]]
    });
    
    // Fetch titles/names for target entities to make the dashboard highly informative
    const reportsWithTargets = await Promise.all(reports.map(async (r) => {
      const json = r.toJSON();
      json.reporter = r.User ? r.User.username : "Unknown User";
      json.title = "N/A";

      try {
        if (r.target_type === 'song') {
          const song = await Song.findByPk(r.target_id, { include: [ArtistProfile] });
          json.title = song ? `${song.title} (by ${song.ArtistProfile?.stage_name || 'Unknown Artist'})` : `Song ID ${r.target_id}`;
        } else if (r.target_type === 'album') {
          const album = await Album.findByPk(r.target_id, { include: [ArtistProfile] });
          json.title = album ? `${album.title} (by ${album.ArtistProfile?.stage_name || 'Unknown Artist'})` : `Album ID ${r.target_id}`;
        } else if (r.target_type === 'user') {
          const user = await User.findByPk(r.target_id);
          json.title = user ? `${user.username} (${user.email})` : `User ID ${r.target_id}`;
        }
      } catch (e) {
        console.error(e);
      }

      return json;
    }));

    res.json({ success: true, reports: reportsWithTargets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Resolve a report (Bans/Moderates target content)
exports.resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findByPk(id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    // Mark report resolved
    await report.update({ status: "resolved" });

    // Moderate target content
    if (report.target_type === 'song') {
      await Song.update({ status: 'moderated' }, { where: { song_id: report.target_id } });
    } else if (report.target_type === 'album') {
      await Album.update({ status: 'moderated' }, { where: { album_id: report.target_id } });
    } else if (report.target_type === 'user') {
      await User.update({ status: 'Inactive' }, { where: { user_id: report.target_id } });
    }

    res.json({ success: true, message: "Report resolved and content moderated.", report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Dismiss a report
exports.dismissReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findByPk(id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    await report.update({ status: "dismissed" });
    res.json({ success: true, message: "Report dismissed.", report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get Songs
exports.getSongs = async (req, res) => {
  try {
    const songs = await Song.findAll({
      include: [
        { model: ArtistProfile, attributes: ["stage_name"] },
        { model: Album, attributes: ["title"] },
        { model: Category, attributes: ["name"] }
      ],
      order: [["created_at", "DESC"]]
    });
    res.json({ success: true, songs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get Albums
exports.getAlbums = async (req, res) => {
  try {
    const albums = await Album.findAll({
      include: [
        { model: ArtistProfile, attributes: ["stage_name"] }
      ],
      order: [["created_at", "DESC"]]
    });
    res.json({ success: true, albums });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get Users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Role, attributes: ["role_name"] }],
      order: [["created_at", "DESC"]]
    });
    
    const formatted = users.map(u => {
      const plain = u.toJSON();
      plain.role_name = u.Role ? u.Role.role_name : null;
      return plain;
    });

    res.json({ success: true, users: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update Song Status
exports.updateSongStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'draft', 'published', 'scheduled', 'moderated', 'archived'
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: "Song not found" });

    await song.update({ status });
    res.json({ success: true, message: `Song status updated to ${status}.`, song });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update Album Status
exports.updateAlbumStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const album = await Album.findByPk(id);
    if (!album) return res.status(404).json({ success: false, message: "Album not found" });

    await album.update({ status });
    res.json({ success: true, message: `Album status updated to ${status}.`, album });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update User Status
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Active', 'Inactive'
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await user.update({ status });
    res.json({ success: true, message: `User account status updated to ${status}.`, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};
