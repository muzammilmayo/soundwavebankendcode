const { 
  Report, 
  ReportHistory, 
  User, 
  Role, 
  Song, 
  Album, 
  Feedback, 
  ArtistProfile, 
  Notification, 
  ArtistModerator 
} = require("../models");
const { Op } = require("sequelize");

// 1. File a Report
exports.createReport = async (req, res) => {
  try {
    const { report_type, target_id, reason, description } = req.body;
    const reporter_id = req.user.id;

    if (!report_type || !reason) {
      return res.status(400).json({ success: false, message: "Report type and reason are required" });
    }

    // Prevent duplicate reports for the same target by the same reporter
    const existing = await Report.findOne({
      where: {
        reporter_id,
        report_type,
        target_id: target_id || null,
        status: { [Op.in]: ["Pending", "Under Review"] }
      }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: "You have already filed a pending report for this item." });
    }

    // Determine initial routing
    let assigned_role = "Admin";
    if (["song", "album", "comment"].includes(report_type)) {
      assigned_role = "Artist Moderator";
    } else if (["artist", "user"].includes(report_type)) {
      assigned_role = "Platform Moderator";
    } else if (report_type === "bug") {
      assigned_role = "Admin";
    }

    const report = await Report.create({
      reporter_id,
      report_type,
      target_id: target_id || null,
      assigned_role,
      reason,
      description,
      status: "Pending"
    });

    // Log to history
    await ReportHistory.create({
      report_id: report.id,
      user_id: reporter_id,
      action: "Report Created",
      notes: "Report submitted by listener."
    });

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    console.error("Error creating report:", err);
    res.status(500).json({ success: false, message: "Server error creating report" });
  }
};

// 2. Get Reports (Scoped by Role)
exports.getReports = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { include: [Role] });
    if (!user || !user.Role) {
      return res.status(403).json({ success: false, message: "Forbidden: role not found" });
    }

    const roleName = user.Role.role_name;
    let whereClause = {};

    if (roleName === "Super Admin" || roleName === "Admin") {
      // Admins see all reports
      whereClause = {};
    } else if (roleName === "Moderator") {
      // Platform Moderator sees User and Artist reports
      whereClause = {
        [Op.or]: [
          { assigned_role: "Platform Moderator" },
          { report_type: { [Op.in]: ["artist", "user"] } }
        ]
      };
    } else if (roleName === "Artist" || req.user.isArtistModerator) {
      // Artist Moderator sees reports for their artist profile only
      const artistProfileId = req.user.artistProfileId;
      if (!artistProfileId) {
        return res.status(200).json({ success: true, data: [] });
      }

      // Fetch all songs and albums owned by this artist
      const songs = await Song.findAll({ where: { artist_profile_id: artistProfileId } });
      const songIds = songs.map(s => String(s.song_id));

      const albums = await Album.findAll({ where: { artist_profile_id: artistProfileId } });
      const albumIds = albums.map(a => String(a.album_id));

      const feedbacks = await Feedback.findAll({ where: { song_id: songs.map(s => s.song_id) } });
      const feedbackIds = feedbacks.map(f => String(f.id));

      whereClause = {
        [Op.or]: [
          {
            report_type: "song",
            target_id: { [Op.in]: songIds }
          },
          {
            report_type: "album",
            target_id: { [Op.in]: albumIds }
          },
          {
            report_type: "comment",
            target_id: { [Op.in]: feedbackIds }
          }
        ]
      };
    } else {
      // Listener role – only see own reports
      whereClause = { reporter_id: req.user.id };
    }

    const reports = await Report.findAll({
      where: whereClause,
      include: [
        { model: User, as: "Reporter", attributes: ["username", "email"] },
        { model: User, as: "Assignee", attributes: ["username"] }
      ],
      order: [["created_at", "DESC"]]
    });

    res.status(200).json({ success: true, data: reports });
  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({ success: false, message: "Server error fetching reports" });
  }
};

// 3. Get Report Details and History
exports.getReportDetails = async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id, {
      include: [
        { model: User, as: "Reporter", attributes: ["username", "email"] },
        { model: User, as: "Assignee", attributes: ["username"] },
        { 
          model: ReportHistory, 
          include: [{ model: User, attributes: ["username"] }]
        }
      ]
    });

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    // Sort history records chronologically descending
    if (report.ReportHistories) {
      report.ReportHistories.sort((a, b) => b.created_at - a.created_at);
    }

    // Fetch target resource details based on report_type
    let targetDetails = null;
    const targetId = report.target_id;

    if (targetId) {
      try {
        if (report.report_type === "song") {
          const song = await Song.findByPk(targetId, { include: [ArtistProfile] });
          if (song) {
            targetDetails = {
              title: song.title,
              artist: song.ArtistProfile ? song.ArtistProfile.stage_name : "Unknown Artist",
              status: song.status,
              cover_image: song.cover_image
            };
          }
        } else if (report.report_type === "album") {
          const album = await Album.findByPk(targetId, { include: [ArtistProfile] });
          if (album) {
            targetDetails = {
              title: album.title,
              artist: album.ArtistProfile ? album.ArtistProfile.stage_name : "Unknown Artist",
              status: album.status,
              cover_image: album.cover_image
            };
          }
        } else if (report.report_type === "artist") {
          const artist = await ArtistProfile.findByPk(targetId, { include: [User] });
          if (artist) {
            targetDetails = {
              stage_name: artist.stage_name,
              bio: artist.bio,
              is_verified: artist.is_verified,
              email: artist.User ? artist.User.email : "N/A"
            };
          }
        } else if (report.report_type === "comment") {
          const feedback = await Feedback.findByPk(targetId, { include: [User, Song] });
          if (feedback) {
            targetDetails = {
              comment: feedback.comment,
              rating: feedback.rating,
              username: feedback.User ? feedback.User.username : "Anonymous",
              song_title: feedback.Song ? feedback.Song.title : `Song #${feedback.song_id}`
            };
          }
        } else if (report.report_type === "user") {
          const userObj = await User.findByPk(targetId, { include: [Role] });
          if (userObj) {
            targetDetails = {
              username: userObj.username,
              email: userObj.email,
              role: userObj.Role ? userObj.Role.role_name : "Listener",
              status: userObj.status || "active"
            };
          }
        }
      } catch (err) {
        console.error("Error fetching target details:", err);
      }
    }

    res.status(200).json({ 
      success: true, 
      data: {
        report,
        targetDetails
      }
    });
  } catch (err) {
    console.error("Error fetching report details:", err);
    res.status(500).json({ success: false, message: "Server error fetching report details" });
  }
};

// 4. Update Report Status or Assignment
exports.updateReportStatus = async (req, res) => {
  try {
    const { status, assigned_to, assigned_role, resolution, notes } = req.body;
    const report = await Report.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const previousStatus = report.status;
    
    if (status) report.status = status;
    if (assigned_to !== undefined) report.assigned_to = assigned_to;
    if (assigned_role !== undefined) report.assigned_role = assigned_role;
    if (resolution !== undefined) report.resolution = resolution;

    await report.save();

    // Log history
    await ReportHistory.create({
      report_id: report.id,
      user_id: req.user.id,
      action: status ? `Status Updated to ${status}` : "Report Assigned",
      notes: notes || `Status updated from ${previousStatus} to ${status || report.status}.`
    });

    // Notify Reporter
    await Notification.create({
      id: require('crypto').randomUUID(),
      user_id: report.reporter_id,
      type: "report_status",
      title: "Report Status Updated",
      message: `Your report (Ref #${report.id}) status has been updated to "${report.status}".`,
      read: false
    });

    res.status(200).json({ success: true, data: report });
  } catch (err) {
    console.error("Error updating report status:", err);
    res.status(500).json({ success: false, message: "Server error updating status" });
  }
};

// 5. Take Moderation Action
exports.takeReportAction = async (req, res) => {
  try {
    const { action, notes, metadata } = req.body;
    const report = await Report.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const targetId = report.target_id;

    if (!targetId && action !== "tech_resolve" && action !== "tech_close" && action !== "tech_in_progress" && action !== "resolve_bug") {
      return res.status(400).json({ success: false, message: "No target resource found for this action" });
    }

    let actionCompletedText = "";

    switch (action) {
      // --- SONG ACTIONS ---
      case "remove_song":
        const song = await Song.findByPk(targetId);
        if (song) {
          song.status = "trash";
          await song.save();
          actionCompletedText = `Song "${song.title}" removed (moved to trash bin).`;
        }
        break;

      case "approve_song":
        const appSong = await Song.findByPk(targetId);
        if (appSong) {
          appSong.status = "published";
          await appSong.save();
          actionCompletedText = `Song "${appSong.title}" approved and restored to catalog.`;
        }
        break;

      case "edit_metadata":
        const editSong = await Song.findByPk(targetId);
        if (editSong && metadata) {
          if (metadata.title) editSong.title = metadata.title;
          if (metadata.category_id) editSong.category_id = metadata.category_id;
          await editSong.save();
          actionCompletedText = `Song metadata updated.`;
        }
        break;

      // --- ALBUM ACTIONS ---
      case "archive_album":
        const album = await Album.findByPk(targetId);
        if (album) {
          album.status = "trash"; // Treat trash as archiving
          await album.save();
          actionCompletedText = `Album "${album.title}" archived.`;
        }
        break;

      case "approve_album":
        const appAlbum = await Album.findByPk(targetId);
        if (appAlbum) {
          appAlbum.status = "published";
          await appAlbum.save();
          actionCompletedText = `Album "${appAlbum.title}" approved and restored to catalog.`;
        }
        break;

      // --- COMMENT ACTIONS ---
      case "delete_comment":
        const feedback = await Feedback.findByPk(targetId);
        if (feedback) {
          await feedback.destroy();
          actionCompletedText = `Comment deleted.`;
        }
        break;

      case "ignore_report":
        actionCompletedText = `Report ignored/dismissed.`;
        break;

      // --- USER / ARTIST ACTIONS ---
      case "warn_user":
      case "warn_artist":
      case "warn_commenter":
        const warnTargetId = action === "warn_commenter" 
          ? (await Feedback.findByPk(targetId))?.user_id
          : (action === "warn_artist" ? (await ArtistProfile.findByPk(targetId))?.user_id : targetId);

        if (warnTargetId) {
          await Notification.create({
            id: require('crypto').randomUUID(),
            user_id: warnTargetId,
            type: "warning",
            title: "Account Warning Issued",
            message: `Your account has received a formal warning due to code of conduct violation reports: ${notes || "No additional notes."}`,
            read: false
          });
          actionCompletedText = `Warning notification issued to user ID ${warnTargetId}.`;
        }
        break;

      case "suspend_user":
      case "suspend_artist":
        const suspendTargetId = action === "suspend_artist"
          ? (await ArtistProfile.findByPk(targetId))?.user_id
          : targetId;

        if (suspendTargetId) {
          const sUser = await User.findByPk(suspendTargetId);
          if (sUser) {
            sUser.status = "suspended";
            await sUser.save();
            actionCompletedText = `User "${sUser.username}" suspended.`;
          }
        }
        break;

      case "ban_user":
        const banUser = await User.findByPk(targetId);
        if (banUser) {
          banUser.status = "banned";
          await banUser.save();
          actionCompletedText = `User "${banUser.username}" banned.`;
        }
        break;

      case "approve_user":
      case "approve_artist":
        const appTargetId = action === "approve_artist"
          ? (await ArtistProfile.findByPk(targetId))?.user_id
          : targetId;
        if (appTargetId) {
          const appUser = await User.findByPk(appTargetId);
          if (appUser) {
            appUser.status = "active";
            await appUser.save();
            actionCompletedText = `User "${appUser.username}" account status restored to active.`;
          }
        }
        break;

      case "escalate_admin":
        report.assigned_role = "Admin";
        report.status = "Under Review";
        await report.save();
        actionCompletedText = `Report escalated to System Admin.`;
        break;

      // --- TECHNICAL ISSUE ACTIONS ---
      case "tech_in_progress":
        report.status = "Under Review";
        report.assigned_to = req.user.id;
        await report.save();
        actionCompletedText = `Technical issue marked In Progress.`;
        break;

      case "tech_resolve":
        report.status = "Resolved";
        report.resolution = resolution || notes || "Technical issue resolved.";
        await report.save();
        actionCompletedText = `Technical issue marked Resolved.`;
        break;

      case "tech_close":
        report.status = "Closed";
        report.resolution = resolution || notes || "Technical issue closed.";
        await report.save();
        actionCompletedText = `Technical issue marked Closed.`;
        break;

      case "resolve_bug":
        actionCompletedText = notes || "Technical issue resolved by administrator.";
        break;

      default:
        return res.status(400).json({ success: false, message: "Invalid moderation action" });
    }

    // Auto-update report status for completed moderation actions
    if (!["escalate_admin", "tech_in_progress", "tech_resolve", "tech_close"].includes(action)) {
      report.status = "Resolved";
      report.resolution = actionCompletedText;
      await report.save();
    }

    // Log history
    await ReportHistory.create({
      report_id: report.id,
      user_id: req.user.id,
      action: `Action Applied: ${action}`,
      notes: notes || actionCompletedText
    });

    // Notify Reporter
    await Notification.create({
      id: require('crypto').randomUUID(),
      user_id: report.reporter_id,
      type: "report_status",
      title: "Report Resolved",
      message: `Your report (Ref #${report.id}) has been marked as Resolved. Resolution: ${actionCompletedText}`,
      read: false
    });

    res.status(200).json({ success: true, message: actionCompletedText, data: report });
  } catch (err) {
    console.error("Error executing report moderation action:", err);
    res.status(500).json({ success: false, message: "Server error performing moderation action" });
  }
};
