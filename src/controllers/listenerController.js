// backend/src/controllers/listenerController.js
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { 
  SongLike, 
  ArtistFollower, 
  Song, 
  ArtistProfile, 
  SavedAlbum, 
  Album, 
  ListeningHistory, 
  Notification, 
  Playlist, 
  PlaylistSong, 
  InteractionLog 
} = require("../models");

const getStateFilePath = (userId) => {
  return path.join(__dirname, '../uploads', `userState_${userId}.json`);
};

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

/**
 * Optimized getState:
 * - Asynchronous non-blocking file access
 * - Parallel execution of database queries using Promise.all
 */
exports.getState = async (req, res) => {
  try {
    const userId = req.user.id;
    const filePath = getStateFilePath(userId);
    let state = {
      playlists: [],
      likedSongs: [],
      savedAlbums: [],
      followedArtists: [],
      downloadedSongs: [],
      notifications: []
    };

    // 1. Asynchronous non-blocking file read for local offline/downloaded state
    try {
      const data = await fs.readFile(filePath, 'utf8');
      if (data) {
        state = { ...state, ...JSON.parse(data) };
      }
    } catch (err) {
      // File doesn't exist yet, continue with defaults
    }

    // 2. Parallel Database Queries to eliminate sequential waterfall
    const [likes, follows, saved, dbNotifs, dbPlaylists] = await Promise.all([
      // Liked Songs
      SongLike.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Song,
            paranoid: false,
            include: [{ model: ArtistProfile, attributes: ["artist_profile_id", "stage_name", "avatar"] }]
          }
        ]
      }),
      // Followed Artists
      ArtistFollower.findAll({
        where: { user_id: userId },
        include: [{ model: ArtistProfile, attributes: ["artist_profile_id", "stage_name", "avatar", "bio"] }]
      }),
      // Saved Albums
      SavedAlbum.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Album,
            include: [{ model: ArtistProfile, attributes: ["artist_profile_id", "stage_name"] }]
          }
        ]
      }),
      // Notifications (latest 50)
      Notification.findAll({
        where: { user_id: userId },
        order: [["timestamp", "DESC"]],
        limit: 50
      }),
      // Playlists
      Playlist.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Song,
            as: "songs",
            paranoid: false,
            include: [{ model: ArtistProfile, attributes: ["artist_profile_id", "stage_name"] }],
            through: {
              attributes: ["order"]
            }
          }
        ]
      })
    ]);

    state.likedSongs = likes.map(l => l.Song).filter(Boolean);
    state.followedArtists = follows.map(f => f.ArtistProfile).filter(Boolean);
    state.savedAlbums = saved.map(s => s.Album).filter(Boolean);
    state.notifications = dbNotifs.map(n => {
      const json = n.toJSON();
      json.targetId = n.target_id;
      return json;
    });

    state.playlists = dbPlaylists.map(p => {
      const json = p.toJSON();
      if (json.songs) {
        json.songs.sort((a, b) => {
          const orderA = a.PlaylistSong ? a.PlaylistSong.order : 0;
          const orderB = b.PlaylistSong ? b.PlaylistSong.order : 0;
          return orderA - orderB;
        });
      } else {
        json.songs = [];
      }
      return json;
    });

    return res.json({ success: true, state });
  } catch (err) {
    console.error("[ListenerController.getState Error]:", err);
    res.status(500).json({ success: false, message: "Failed to retrieve user state." });
  }
};

/**
 * Optimized saveState:
 * - Asynchronous non-blocking file write
 * - Parallel execution across distinct entities (likes, follows, saved albums, notifications, playlists)
 */
exports.saveState = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      playlists = [], 
      likedSongs = [], 
      savedAlbums = [], 
      followedArtists = [], 
      downloadedSongs = [], 
      notifications = [] 
    } = req.body;

    // 1. Asynchronous non-blocking write for offline state
    const filePath = getStateFilePath(userId);
    const fileState = { downloadedSongs };
    fs.writeFile(filePath, JSON.stringify(fileState, null, 2), 'utf8').catch(err => {
      console.error("[ListenerController.saveState File Error]:", err);
    });

    // 2. Sync Liked Songs
    const syncLikes = async () => {
      const currentLikes = await SongLike.findAll({ where: { user_id: userId } });
      const currentLikedSongIds = currentLikes.map(l => l.song_id);
      const newLikedSongIds = likedSongs.map(s => s.song_id);

      const toAddLikes = newLikedSongIds.filter(id => !currentLikedSongIds.includes(id));
      const toRemoveLikes = currentLikedSongIds.filter(id => !newLikedSongIds.includes(id));

      const ops = [];
      if (toAddLikes.length > 0) {
        ops.push(
          SongLike.bulkCreate(toAddLikes.map(songId => ({ user_id: userId, song_id: songId }))),
          InteractionLog.bulkCreate(toAddLikes.map(songId => ({
            user_id: userId,
            interaction_type: "like",
            target_type: "song",
            target_id: String(songId)
          })))
        );
      }
      if (toRemoveLikes.length > 0) {
        ops.push(
          SongLike.destroy({ where: { user_id: userId, song_id: toRemoveLikes } }),
          InteractionLog.bulkCreate(toRemoveLikes.map(songId => ({
            user_id: userId,
            interaction_type: "unlike",
            target_type: "song",
            target_id: String(songId)
          })))
        );
      }
      await Promise.all(ops);
    };

    // 3. Sync Followed Artists
    const syncFollows = async () => {
      const currentFollows = await ArtistFollower.findAll({ where: { user_id: userId } });
      const currentFollowedArtistIds = currentFollows.map(f => f.artist_profile_id);
      const newFollowedArtistIds = followedArtists.map(a => a.artist_profile_id);

      const toAddFollows = newFollowedArtistIds.filter(id => !currentFollowedArtistIds.includes(id));
      const toRemoveFollows = currentFollowedArtistIds.filter(id => !newFollowedArtistIds.includes(id));

      const ops = [];
      if (toAddFollows.length > 0) {
        ops.push(
          ArtistFollower.bulkCreate(toAddFollows.map(artistProfileId => ({ user_id: userId, artist_profile_id: artistProfileId }))),
          InteractionLog.bulkCreate(toAddFollows.map(artistProfileId => ({
            user_id: userId,
            interaction_type: "follow",
            target_type: "artist",
            target_id: String(artistProfileId)
          })))
        );
      }
      if (toRemoveFollows.length > 0) {
        ops.push(
          ArtistFollower.destroy({ where: { user_id: userId, artist_profile_id: toRemoveFollows } }),
          InteractionLog.bulkCreate(toRemoveFollows.map(artistProfileId => ({
            user_id: userId,
            interaction_type: "unfollow",
            target_type: "artist",
            target_id: String(artistProfileId)
          })))
        );
      }
      await Promise.all(ops);
    };

    // 4. Sync Saved Albums
    const syncSavedAlbums = async () => {
      const currentSaved = await SavedAlbum.findAll({ where: { user_id: userId } });
      const currentSavedAlbumIds = currentSaved.map(s => s.album_id);
      const newSavedAlbumIds = savedAlbums.map(a => a.album_id);

      const toAddSaved = newSavedAlbumIds.filter(id => !currentSavedAlbumIds.includes(id));
      const toRemoveSaved = currentSavedAlbumIds.filter(id => !newSavedAlbumIds.includes(id));

      const ops = [];
      if (toAddSaved.length > 0) {
        ops.push(
          SavedAlbum.bulkCreate(toAddSaved.map(albumId => ({ user_id: userId, album_id: albumId }))),
          InteractionLog.bulkCreate(toAddSaved.map(albumId => ({
            user_id: userId,
            interaction_type: "save_album",
            target_type: "album",
            target_id: String(albumId)
          })))
        );
      }
      if (toRemoveSaved.length > 0) {
        ops.push(
          SavedAlbum.destroy({ where: { user_id: userId, album_id: toRemoveSaved } }),
          InteractionLog.bulkCreate(toRemoveSaved.map(albumId => ({
            user_id: userId,
            interaction_type: "unsave_album",
            target_type: "album",
            target_id: String(albumId)
          })))
        );
      }
      await Promise.all(ops);
    };

    // 5. Sync Notifications
    const syncNotifications = async () => {
      const currentNotifs = await Notification.findAll({ where: { user_id: userId } });
      const currentNotifIds = currentNotifs.map(n => n.id);
      const incomingNotifIds = notifications.map(n => n.id);

      const notifOps = [];
      for (const notif of notifications) {
        const data = {
          id: notif.id,
          user_id: userId,
          type: notif.type,
          target_id: notif.targetId,
          title: notif.title,
          message: notif.message,
          timestamp: notif.timestamp || new Date().toISOString(),
          read: notif.read || false,
          cleared: notif.cleared || false
        };
        
        if (currentNotifIds.includes(notif.id)) {
          notifOps.push(Notification.update(data, { where: { id: notif.id } }));
        } else {
          notifOps.push(Notification.create(data));
        }
      }

      const toRemoveNotifs = currentNotifIds.filter(id => !incomingNotifIds.includes(id));
      if (toRemoveNotifs.length > 0) {
        notifOps.push(Notification.destroy({ where: { id: toRemoveNotifs } }));
      }
      await Promise.all(notifOps);
    };

    // 6. Sync Playlists
    const syncPlaylists = async () => {
      const currentPlaylists = await Playlist.findAll({ where: { user_id: userId } });
      const currentPlaylistIds = currentPlaylists.map(p => p.id);
      const incomingPlaylistIds = playlists.map(p => p.id);

      for (const playlist of playlists) {
        if (currentPlaylistIds.includes(playlist.id)) {
          await Playlist.update({ name: playlist.name }, { where: { id: playlist.id } });
        } else {
          await Playlist.create({ id: playlist.id, name: playlist.name, user_id: userId });
          InteractionLog.create({
            user_id: userId,
            interaction_type: "create_playlist",
            target_type: "playlist",
            target_id: String(playlist.id),
            details: playlist.name
          }).catch(err => console.error(err));
        }

        // Sync playlist songs
        const oldPlaylistSongs = await PlaylistSong.findAll({ where: { playlist_id: playlist.id } });
        const oldSongIds = oldPlaylistSongs.map(ps => ps.song_id);

        await PlaylistSong.destroy({ where: { playlist_id: playlist.id } });
        if (playlist.songs && playlist.songs.length > 0) {
          const bulkSongs = playlist.songs.map((song, idx) => ({
            playlist_id: playlist.id,
            song_id: song.song_id,
            order: idx
          }));
          await PlaylistSong.bulkCreate(bulkSongs);

          const newlyAddedSongIds = playlist.songs.map(s => s.song_id).filter(id => !oldSongIds.includes(id));
          if (newlyAddedSongIds.length > 0) {
            InteractionLog.bulkCreate(newlyAddedSongIds.map(songId => ({
              user_id: userId,
              interaction_type: "add_to_playlist",
              target_type: "song",
              target_id: String(songId),
              details: String(playlist.id)
            }))).catch(err => console.error(err));
          }
        }
      }

      const toRemovePlaylists = currentPlaylistIds.filter(id => !incomingPlaylistIds.includes(id));
      if (toRemovePlaylists.length > 0) {
        await Playlist.destroy({ where: { id: toRemovePlaylists } });
      }
    };

    // Execute entity sync operations in parallel
    await Promise.all([
      syncLikes(),
      syncFollows(),
      syncSavedAlbums(),
      syncNotifications(),
      syncPlaylists()
    ]);

    res.json({ success: true, message: "State and database relationships saved successfully" });
  } catch (err) {
    console.error("[ListenerController.saveState Error]:", err);
    res.status(500).json({ success: false, message: "Failed to save state." });
  }
};

exports.recordSongPlay = async (req, res) => {
  try {
    const userId = req.user.id;
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ success: false, message: "songId is required" });

    // Non-blocking interaction and history recording
    await Promise.all([
      ListeningHistory.create({
        user_id: userId,
        song_id: songId,
        played_at: new Date().toISOString()
      }),
      InteractionLog.create({
        user_id: userId,
        interaction_type: "play",
        target_type: "song",
        target_id: String(songId)
      }),
      Song.findByPk(songId, { paranoid: false }).then(song => {
        if (song) return song.increment("play_count", { by: 1 });
      })
    ]);

    res.status(201).json({ success: true, message: "Play history recorded successfully" });
  } catch (err) {
    console.error("[ListenerController.recordSongPlay Error]:", err);
    res.status(500).json({ success: false, message: "Failed to record play." });
  }
};

exports.getRecentlyPlayed = async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await ListeningHistory.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Song,
          paranoid: false,
          include: [{ model: ArtistProfile, attributes: ["artist_profile_id", "stage_name"] }]
        }
      ],
      order: [["played_at", "DESC"]],
      limit: 50
    });

    res.json({ success: true, history });
  } catch (err) {
    console.error("[ListenerController.getRecentlyPlayed Error]:", err);
    res.status(500).json({ success: false, message: "Failed to retrieve history." });
  }
};

exports.listDeletedPlaylists = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const playlists = await Playlist.findAll({
      where: {
        user_id: req.user.id,
        deleted_at: { [Op.ne]: null }
      },
      paranoid: false
    });
    res.json({ success: true, playlists });
  } catch (err) {
    console.error("[ListenerController.listDeletedPlaylists Error]:", err);
    res.status(500).json({ success: false, message: "Failed to list deleted playlists." });
  }
};

exports.restoreDeletedPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const playlist = await Playlist.findByPk(id, { paranoid: false });
    
    if (!playlist) return res.status(404).json({ success: false, message: "Playlist not found" });
    if (playlist.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await playlist.restore();
    res.json({ success: true, message: "Playlist restored successfully" });
  } catch (err) {
    console.error("[ListenerController.restoreDeletedPlaylist Error]:", err);
    res.status(500).json({ success: false, message: "Failed to restore playlist." });
  }
};

exports.trackActivity = async (req, res) => {
  try {
    const { action, songId } = req.body;
    if (!action || !songId) {
      return res.status(400).json({ success: false, message: "action and songId are required" });
    }

    await InteractionLog.create({
      user_id: req.user.id,
      interaction_type: action,
      target_type: "song",
      target_id: String(songId)
    });

    res.json({ success: true, message: `Activity logged: ${action}` });
  } catch (err) {
    console.error("[ListenerController.trackActivity Error]:", err);
    res.status(500).json({ success: false, message: "Failed to track activity." });
  }
};
