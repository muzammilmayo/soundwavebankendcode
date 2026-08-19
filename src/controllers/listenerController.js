// backend/src/controllers/listenerController.js
const fs = require('fs').promises;
const path = require('path');
const { Op } = require('sequelize');
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

/**
 * Helper to robustly extract positive integer ID from various payload formats
 */
const extractId = (item, primaryKey, fallbackKeys = []) => {
  if (item === undefined || item === null) return null;
  if (typeof item === 'number') return item > 0 ? item : null;
  if (typeof item === 'string') {
    const num = parseInt(item, 10);
    return !isNaN(num) && num > 0 ? num : null;
  }
  if (typeof item === 'object') {
    if (item[primaryKey] !== undefined && item[primaryKey] !== null) {
      const num = parseInt(item[primaryKey], 10);
      if (!isNaN(num) && num > 0) return num;
    }
    for (const key of fallbackKeys) {
      if (item[key] !== undefined && item[key] !== null) {
        const num = parseInt(item[key], 10);
        if (!isNaN(num) && num > 0) return num;
      }
    }
  }
  return null;
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
 * Optimized & Robust getState:
 * - Asynchronous non-blocking file access
 * - Parallel execution of database queries using Promise.all
 * - Clean JSON serialization
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
            include: [{ model: ArtistProfile, attributes: ["artist_profile_id", "stage_name", "profile_image"] }]
          }
        ]
      }),
      // Followed Artists
      ArtistFollower.findAll({
        where: { user_id: userId },
        include: [{ model: ArtistProfile }]
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

    state.likedSongs = likes.map(l => l.Song ? l.Song.toJSON() : null).filter(Boolean);
    state.followedArtists = follows.map(f => f.ArtistProfile ? f.ArtistProfile.toJSON() : null).filter(Boolean);
    state.savedAlbums = saved.map(s => s.Album ? s.Album.toJSON() : null).filter(Boolean);
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
 * Optimized & Robust saveState:
 * - Handles IDs as numbers, strings, or nested objects
 * - Safe array checking and bulk database operations
 * - Error isolation so individual syncs don't block the rest
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

    // 1. Non-blocking file write for offline state
    const filePath = getStateFilePath(userId);
    const fileState = { downloadedSongs };
    fs.writeFile(filePath, JSON.stringify(fileState, null, 2), 'utf8').catch(err => {
      console.error("[ListenerController.saveState File Error]:", err);
    });

    // 2. Sync Liked Songs
    const syncLikes = async () => {
      try {
        const currentLikes = await SongLike.findAll({ where: { user_id: userId } });
        const currentLikedSongIds = currentLikes.map(l => l.song_id);
        const newLikedSongIds = likedSongs.map(s => extractId(s, 'song_id', ['id'])).filter(Boolean);

        const toAddLikes = newLikedSongIds.filter(id => !currentLikedSongIds.includes(id));
        const toRemoveLikes = currentLikedSongIds.filter(id => !newLikedSongIds.includes(id));

        if (toAddLikes.length > 0) {
          await SongLike.bulkCreate(
            toAddLikes.map(songId => ({ user_id: userId, song_id: songId })),
            { ignoreDuplicates: true }
          );
          InteractionLog.bulkCreate(toAddLikes.map(songId => ({
            user_id: userId,
            interaction_type: "like",
            target_type: "song",
            target_id: String(songId)
          }))).catch(err => console.error(err));
        }
        if (toRemoveLikes.length > 0) {
          await SongLike.destroy({ where: { user_id: userId, song_id: { [Op.in]: toRemoveLikes } } });
          InteractionLog.bulkCreate(toRemoveLikes.map(songId => ({
            user_id: userId,
            interaction_type: "unlike",
            target_type: "song",
            target_id: String(songId)
          }))).catch(err => console.error(err));
        }
      } catch (err) {
        console.error("[syncLikes Error]:", err);
      }
    };

    // 3. Sync Followed Artists
    const syncFollows = async () => {
      try {
        const currentFollows = await ArtistFollower.findAll({ where: { user_id: userId } });
        const currentFollowedArtistIds = currentFollows.map(f => f.artist_profile_id);
        const newFollowedArtistIds = followedArtists.map(a => extractId(a, 'artist_profile_id', ['id', 'artist_id'])).filter(Boolean);

        const toAddFollows = newFollowedArtistIds.filter(id => !currentFollowedArtistIds.includes(id));
        const toRemoveFollows = currentFollowedArtistIds.filter(id => !newFollowedArtistIds.includes(id));

        if (toAddFollows.length > 0) {
          await ArtistFollower.bulkCreate(
            toAddFollows.map(artistProfileId => ({ user_id: userId, artist_profile_id: artistProfileId })),
            { ignoreDuplicates: true }
          );
          InteractionLog.bulkCreate(toAddFollows.map(artistProfileId => ({
            user_id: userId,
            interaction_type: "follow",
            target_type: "artist",
            target_id: String(artistProfileId)
          }))).catch(err => console.error(err));
        }
        if (toRemoveFollows.length > 0) {
          await ArtistFollower.destroy({ where: { user_id: userId, artist_profile_id: { [Op.in]: toRemoveFollows } } });
          InteractionLog.bulkCreate(toRemoveFollows.map(artistProfileId => ({
            user_id: userId,
            interaction_type: "unfollow",
            target_type: "artist",
            target_id: String(artistProfileId)
          }))).catch(err => console.error(err));
        }
      } catch (err) {
        console.error("[syncFollows Error]:", err);
      }
    };

    // 4. Sync Saved Albums
    const syncSavedAlbums = async () => {
      try {
        const currentSaved = await SavedAlbum.findAll({ where: { user_id: userId } });
        const currentSavedAlbumIds = currentSaved.map(s => s.album_id);
        const newSavedAlbumIds = savedAlbums.map(a => extractId(a, 'album_id', ['id'])).filter(Boolean);

        const toAddSaved = newSavedAlbumIds.filter(id => !currentSavedAlbumIds.includes(id));
        const toRemoveSaved = currentSavedAlbumIds.filter(id => !newSavedAlbumIds.includes(id));

        if (toAddSaved.length > 0) {
          await SavedAlbum.bulkCreate(
            toAddSaved.map(albumId => ({ user_id: userId, album_id: albumId })),
            { ignoreDuplicates: true }
          );
          InteractionLog.bulkCreate(toAddSaved.map(albumId => ({
            user_id: userId,
            interaction_type: "save_album",
            target_type: "album",
            target_id: String(albumId)
          }))).catch(err => console.error(err));
        }
        if (toRemoveSaved.length > 0) {
          await SavedAlbum.destroy({ where: { user_id: userId, album_id: { [Op.in]: toRemoveSaved } } });
          InteractionLog.bulkCreate(toRemoveSaved.map(albumId => ({
            user_id: userId,
            interaction_type: "unsave_album",
            target_type: "album",
            target_id: String(albumId)
          }))).catch(err => console.error(err));
        }
      } catch (err) {
        console.error("[syncSavedAlbums Error]:", err);
      }
    };

    // 5. Sync Notifications
    const syncNotifications = async () => {
      try {
        const currentNotifs = await Notification.findAll({ where: { user_id: userId } });
        const currentNotifIds = currentNotifs.map(n => n.id);
        const incomingNotifIds = notifications.map(n => String(n.id || '')).filter(Boolean);

        for (const notif of notifications) {
          const notifId = String(notif.id || `notif_${Date.now()}_${Math.random()}`);
          const targetIdNum = parseInt(notif.targetId || notif.target_id, 10);
          const data = {
            id: notifId,
            user_id: userId,
            type: notif.type || 'general',
            target_id: !isNaN(targetIdNum) ? targetIdNum : null,
            title: notif.title || '',
            message: notif.message || '',
            timestamp: notif.timestamp || new Date().toISOString(),
            read: !!notif.read,
            cleared: !!notif.cleared
          };
          
          if (currentNotifIds.includes(notifId)) {
            await Notification.update(data, { where: { id: notifId } });
          } else {
            await Notification.create(data);
          }
        }

        const toRemoveNotifs = currentNotifIds.filter(id => !incomingNotifIds.includes(id));
        if (toRemoveNotifs.length > 0) {
          await Notification.destroy({ where: { id: { [Op.in]: toRemoveNotifs } } });
        }
      } catch (err) {
        console.error("[syncNotifications Error]:", err);
      }
    };

    // 6. Sync Playlists
    const syncPlaylists = async () => {
      try {
        const currentPlaylists = await Playlist.findAll({ where: { user_id: userId } });
        const currentPlaylistIds = currentPlaylists.map(p => p.id);
        const incomingPlaylistIds = playlists.map(p => String(p.id || '')).filter(Boolean);

        for (const playlist of playlists) {
          const playlistId = String(playlist.id);
          if (!playlistId) continue;

          if (currentPlaylistIds.includes(playlistId)) {
            await Playlist.update({ name: playlist.name }, { where: { id: playlistId } });
          } else {
            await Playlist.create({ id: playlistId, name: playlist.name, user_id: userId });
            InteractionLog.create({
              user_id: userId,
              interaction_type: "create_playlist",
              target_type: "playlist",
              target_id: playlistId,
              details: playlist.name
            }).catch(err => console.error(err));
          }

          // Sync playlist songs
          const oldPlaylistSongs = await PlaylistSong.findAll({ where: { playlist_id: playlistId } });
          const oldSongIds = oldPlaylistSongs.map(ps => ps.song_id);

          await PlaylistSong.destroy({ where: { playlist_id: playlistId } });
          if (playlist.songs && playlist.songs.length > 0) {
            const bulkSongs = [];
            playlist.songs.forEach((song, idx) => {
              const songId = extractId(song, 'song_id', ['id']);
              if (songId) {
                bulkSongs.push({
                  playlist_id: playlistId,
                  song_id: songId,
                  order: idx
                });
              }
            });

            if (bulkSongs.length > 0) {
              await PlaylistSong.bulkCreate(bulkSongs, { ignoreDuplicates: true });

              const newlyAddedSongIds = bulkSongs.map(s => s.song_id).filter(id => !oldSongIds.includes(id));
              if (newlyAddedSongIds.length > 0) {
                InteractionLog.bulkCreate(newlyAddedSongIds.map(songId => ({
                  user_id: userId,
                  interaction_type: "add_to_playlist",
                  target_type: "song",
                  target_id: String(songId),
                  details: playlistId
                }))).catch(err => console.error(err));
              }
            }
          }
        }

        const toRemovePlaylists = currentPlaylistIds.filter(id => !incomingPlaylistIds.includes(id));
        if (toRemovePlaylists.length > 0) {
          await Playlist.destroy({ where: { id: { [Op.in]: toRemovePlaylists } } });
        }
      } catch (err) {
        console.error("[syncPlaylists Error]:", err);
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
