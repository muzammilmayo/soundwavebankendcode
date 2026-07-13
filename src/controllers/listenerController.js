// listenerController.js
const fs = require('fs');
const path = require('path');
const { SongLike, ArtistFollower, Song, ArtistProfile } = require("../models");

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

    // 1. Save state to JSON file (playlists, savedAlbums, downloadedSongs, notifications)
    const filePath = getStateFilePath(userId);
    const fileState = {
      playlists,
      savedAlbums,
      downloadedSongs,
      notifications
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

    res.json({ success: true, message: "State and database relationships saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};
