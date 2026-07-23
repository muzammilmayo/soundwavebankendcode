// listenerController.js
const fs = require('fs');
const path = require('path');
const { SongLike, ArtistFollower, Song, ArtistProfile, SavedAlbum, Album, ListeningHistory, Notification, Playlist, PlaylistSong } = require("../models");

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

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      state = { ...state, ...JSON.parse(data) };
    }

    // Load Liked Songs from database
    const likes = await SongLike.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Song,
          include: [ArtistProfile]
        }
      ]
    });
    state.likedSongs = likes.map(l => l.Song).filter(Boolean);

    // Load Followed Artists from database
    const follows = await ArtistFollower.findAll({
      where: { user_id: userId },
      include: [ArtistProfile]
    });
    state.followedArtists = follows.map(f => f.ArtistProfile).filter(Boolean);

    // Load Saved Albums from database
    const saved = await SavedAlbum.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Album,
          include: [ArtistProfile]
        }
      ]
    });
    state.savedAlbums = saved.map(s => s.Album).filter(Boolean);

    // Load Notifications from database
    const dbNotifs = await Notification.findAll({
      where: { user_id: userId }
    });
    state.notifications = dbNotifs.map(n => {
      const json = n.toJSON();
      json.targetId = n.target_id; // map backend target_id to frontend targetId
      return json;
    });

    // Load Playlists from database
    const dbPlaylists = await Playlist.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Song,
          as: "songs",
          include: [ArtistProfile],
          through: {
            attributes: ["order"]
          }
        }
      ]
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
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveState = async (req, res) => {
  try {
    const userId = req.user.id;
    const { playlists = [], likedSongs = [], savedAlbums = [], followedArtists = [], downloadedSongs = [], notifications = [] } = req.body;

    // 1. Save state to JSON file (downloadedSongs)
    const filePath = getStateFilePath(userId);
    const fileState = {
      downloadedSongs
    };
    fs.writeFileSync(filePath, JSON.stringify(fileState, null, 2), 'utf8');

    // 2. Sync Liked Songs to Database
    const currentLikes = await SongLike.findAll({ where: { user_id: userId } });
    const currentLikedSongIds = currentLikes.map(l => l.song_id);
    const newLikedSongIds = likedSongs.map(s => s.song_id);

    // Identify songs to like (add)
    const toAddLikes = newLikedSongIds.filter(id => !currentLikedSongIds.includes(id));
    // Identify songs to unlike (delete)
    const toRemoveLikes = currentLikedSongIds.filter(id => !newLikedSongIds.includes(id));

    if (toAddLikes.length > 0) {
      await SongLike.bulkCreate(toAddLikes.map(songId => ({ user_id: userId, song_id: songId })));
    }
    if (toRemoveLikes.length > 0) {
      await SongLike.destroy({ where: { user_id: userId, song_id: toRemoveLikes } });
    }

    // 3. Sync Followed Artists to Database
    const currentFollows = await ArtistFollower.findAll({ where: { user_id: userId } });
    const currentFollowedArtistIds = currentFollows.map(f => f.artist_profile_id);
    const newFollowedArtistIds = followedArtists.map(a => a.artist_profile_id);

    // Identify artists to follow (add)
    const toAddFollows = newFollowedArtistIds.filter(id => !currentFollowedArtistIds.includes(id));
    // Identify artists to unfollow (delete)
    const toRemoveFollows = currentFollowedArtistIds.filter(id => !newFollowedArtistIds.includes(id));

    if (toAddFollows.length > 0) {
      await ArtistFollower.bulkCreate(toAddFollows.map(artistProfileId => ({ user_id: userId, artist_profile_id: artistProfileId })));
    }
    if (toRemoveFollows.length > 0) {
      await ArtistFollower.destroy({ where: { user_id: userId, artist_profile_id: toRemoveFollows } });
    }

    // 4. Sync Saved Albums to Database
    const currentSaved = await SavedAlbum.findAll({ where: { user_id: userId } });
    const currentSavedAlbumIds = currentSaved.map(s => s.album_id);
    const newSavedAlbumIds = savedAlbums.map(a => a.album_id);

    // Identify albums to save (add)
    const toAddSaved = newSavedAlbumIds.filter(id => !currentSavedAlbumIds.includes(id));
    // Identify albums to unsave (delete)
    const toRemoveSaved = currentSavedAlbumIds.filter(id => !newSavedAlbumIds.includes(id));

    if (toAddSaved.length > 0) {
      await SavedAlbum.bulkCreate(toAddSaved.map(albumId => ({ user_id: userId, album_id: albumId })));
    }
    if (toRemoveSaved.length > 0) {
      await SavedAlbum.destroy({ where: { user_id: userId, album_id: toRemoveSaved } });
    }

    // 5. Sync Notifications to Database
    const currentNotifs = await Notification.findAll({ where: { user_id: userId } });
    const currentNotifIds = currentNotifs.map(n => n.id);
    const incomingNotifIds = notifications.map(n => n.id);

    // Sync incoming notifications
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
        await Notification.update(data, { where: { id: notif.id } });
      } else {
        await Notification.create(data);
      }
    }

    // Identify notifications to delete
    const toRemoveNotifs = currentNotifIds.filter(id => !incomingNotifIds.includes(id));
    if (toRemoveNotifs.length > 0) {
      await Notification.destroy({ where: { id: toRemoveNotifs } });
    }

    // 6. Sync Playlists to Database
    const currentPlaylists = await Playlist.findAll({ where: { user_id: userId } });
    const currentPlaylistIds = currentPlaylists.map(p => p.id);
    const incomingPlaylistIds = playlists.map(p => p.id);

    for (const playlist of playlists) {
      if (currentPlaylistIds.includes(playlist.id)) {
        await Playlist.update({ name: playlist.name }, { where: { id: playlist.id } });
      } else {
        await Playlist.create({ id: playlist.id, name: playlist.name, user_id: userId });
      }

      // Sync playlist songs (simplest is clear and rebuild to keep indices sequential & correct)
      await PlaylistSong.destroy({ where: { playlist_id: playlist.id } });
      if (playlist.songs && playlist.songs.length > 0) {
        const bulkSongs = playlist.songs.map((song, idx) => ({
          playlist_id: playlist.id,
          song_id: song.song_id,
          order: idx
        }));
        await PlaylistSong.bulkCreate(bulkSongs);
      }
    }

    // Identify playlists to delete
    const toRemovePlaylists = currentPlaylistIds.filter(id => !incomingPlaylistIds.includes(id));
    if (toRemovePlaylists.length > 0) {
      await Playlist.destroy({ where: { id: toRemovePlaylists } });
    }

    res.json({ success: true, message: "State and database relationships saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.recordSongPlay = async (req, res) => {
  try {
    const userId = req.user.id;
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ success: false, message: "songId is required" });

    await ListeningHistory.create({
      user_id: userId,
      song_id: songId,
      played_at: new Date().toISOString()
    });

    // Increment play_count of the song
    const song = await Song.findByPk(songId);
    if (song) {
      await song.increment("play_count", { by: 1 });
    }

    res.status(201).json({ success: true, message: "Play history recorded successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
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
          include: [ArtistProfile]
        }
      ],
      order: [["played_at", "DESC"]],
      limit: 50
    });

    res.json({ success: true, history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};
