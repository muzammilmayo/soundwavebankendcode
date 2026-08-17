// backend/src/controllers/catalogController.js

const { ArtistProfile, Album, Song, Category, User, Role, Feedback, ArtistFollower, Notification, InteractionLog } = require("../models");
const { Op, Sequelize } = require("sequelize");
const mediaService = require("../services/mediaService");
const cacheService = require("../services/cacheService");
const RequestValidator = require("../validators");

/** ---------------------------------------------------------------
 * PUBLIC ENDPOINTS – accessible to any logged‑in user (or unauth)
 * --------------------------------------------------------------- */
exports.browseArtists = async (req, res) => {
  try {
    const { search } = req.query;
    const { page, limit, offset } = RequestValidator.sanitizePagination(req.query, 10, 50);

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { stage_name: { [Op.like]: `%${search}%` } },
        { bio: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await ArtistProfile.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ["created_at", "updated_at"] },
      include: [{ model: User, attributes: ["username", "email"], where: { status: "Active" } }],
      limit,
      offset,
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.json({ 
      success: true, 
      artists: rows,
      pagination: {
        totalRecords: count,
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    });
  } catch (err) {
    console.error("[browseArtists Error]:", err);
    res.status(500).json({ success: false, message: "Failed to browse artists." });
  }
};

exports.browseAlbums = async (req, res) => {
  try {
    const { search } = req.query;
    const { page, limit, offset } = RequestValidator.sanitizePagination(req.query, 10, 50);

    const whereClause = { status: 'published' };
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { "$ArtistProfile.stage_name$": { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Album.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: ArtistProfile, 
          attributes: ["stage_name"],
          include: [{ model: User, attributes: [], where: { status: "Active" } }]
        }
      ],
      limit,
      offset,
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.json({ 
      success: true, 
      albums: rows,
      pagination: {
        totalRecords: count,
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    });
  } catch (err) {
    console.error("[browseAlbums Error]:", err);
    res.status(500).json({ success: false, message: "Failed to browse albums." });
  }
};

exports.browseSongs = async (req, res) => {
  try {
    const { search, category, artist, album, year, duration, status, sort } = req.query;
    const { page, limit, offset } = RequestValidator.sanitizePagination(req.query, 10, 50);
    const whereClause = {};

    // Lifecycle/status filtering
    let allowedStatuses = ['published'];
    if (req.user) {
      const user = await User.findByPk(req.user.id);
      const role = await Role.findByPk(user?.role_id);
      if (role && (role.role_name === 'Admin' || role.role_name === 'Super Admin' || role.role_name === 'Moderator')) {
        allowedStatuses = ['draft', 'pending_review', 'scheduled', 'published', 'archived'];
      } else if (role && role.role_name === 'Artist') {
        const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
        if (profile) {
          whereClause[Op.or] = [
            { status: 'published' },
            { artist_profile_id: profile.artist_profile_id }
          ];
        }
      }
    }

    if (!whereClause[Op.or]) {
      if (status && allowedStatuses.includes(status)) {
        whereClause.status = status;
      } else {
        whereClause.status = allowedStatuses;
      }
    }

    if (category) whereClause.category_id = category;
    if (artist) whereClause.artist_profile_id = artist;
    if (album) whereClause.album_id = album;

    if (year) {
      whereClause.release_date = Sequelize.where(
        Sequelize.fn('YEAR', Sequelize.col('Song.release_date')),
        year
      );
    }

    if (duration) {
      if (duration === "short") whereClause.duration = { [Op.lt]: 180 };
      else if (duration === "medium") whereClause.duration = { [Op.between]: [180, 300] };
      else if (duration === "long") whereClause.duration = { [Op.gt]: 300 };
    }

    if (search) {
      const searchConditions = [
        { title: { [Op.like]: `%${search}%` } },
        { tags: { [Op.like]: `%${search}%` } },
        { '$ArtistProfile.stage_name$': { [Op.like]: `%${search}%` } },
        { '$Album.title$': { [Op.like]: `%${search}%` } },
        { '$Category.name$': { [Op.like]: `%${search}%` } }
      ];
      if (whereClause[Op.or]) {
        whereClause[Op.and] = [
          { [Op.or]: whereClause[Op.or] },
          { [Op.or]: searchConditions }
        ];
        delete whereClause[Op.or];
      } else {
        whereClause[Op.or] = searchConditions;
      }

      InteractionLog.create({
        user_id: req.user ? req.user.id : null,
        interaction_type: "search",
        target_type: "none",
        target_id: null,
        details: search
      }).catch(err => console.error("[CatalogController] Error logging search:", err));
    }

    const likesCountCol = [
      Sequelize.literal(`(
        SELECT COUNT(*)
        FROM song_likes AS likes
        WHERE likes.song_id = Song.song_id
      )`),
      'likes_count'
    ];

    let order = [["created_at", "DESC"]];
    if (sort === "oldest") order = [["created_at", "ASC"]];
    else if (sort === "popular") order = [["play_count", "DESC"]];
    else if (sort === "most_liked") order = [[Sequelize.literal('likes_count'), 'DESC']];
    else if (sort === "alphabetical") order = [["title", "ASC"]];
    else if (sort === "z-a") order = [["title", "DESC"]];

    const { count, rows } = await Song.findAndCountAll({
      where: whereClause,
      paranoid: false,
      include: [
        { 
          model: ArtistProfile, 
          attributes: ["stage_name"],
          include: [{ model: User, attributes: [], where: { status: "Active" } }]
        },
        { model: Album, attributes: ["title"] },
        { model: Category, attributes: ["name"] },
      ],
      attributes: { include: [likesCountCol] },
      order,
      limit,
      offset,
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.json({ 
      success: true, 
      songs: rows,
      pagination: {
        totalRecords: count,
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    });
  } catch (err) {
    console.error("[browseSongs Error]:", err);
    res.status(500).json({ success: false, message: "Failed to browse songs." });
  }
};

/**
 * Cached Category Listing (5-minute TTL)
 */
exports.browseCategories = async (req, res) => {
  try {
    const cacheKey = "catalog:categories";
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, categories: cached, fromCache: true });
    }

    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    cacheService.set(cacheKey, categories, 300, ['categories']);
    res.json({ success: true, categories });
  } catch (err) {
    console.error("[browseCategories Error]:", err);
    res.status(500).json({ success: false, message: "Failed to browse categories." });
  }
};

/**
 * Cached Trending Aggregation (60-second TTL to handle heavy traffic)
 */
exports.getTrendingContent = async (req, res) => {
  try {
    const cacheKey = "catalog:trending_content";
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const getTrendingIds = async (sinceDate) => {
      const logs = await InteractionLog.findAll({
        attributes: [
          'target_id',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'interaction_count']
        ],
        where: {
          interaction_type: ['play', 'like'],
          target_type: 'song',
          created_at: { [Op.gte]: sinceDate }
        },
        group: ['target_id'],
        order: [[Sequelize.literal('interaction_count'), 'DESC']],
        limit: 10
      });
      return logs.map(l => parseInt(l.target_id, 10)).filter(id => !isNaN(id));
    };

    const [weeklyIds, monthlyIds] = await Promise.all([
      getTrendingIds(sevenDaysAgo),
      getTrendingIds(thirtyDaysAgo)
    ]);

    const likesCountCol = [
      Sequelize.literal(`(
        SELECT COUNT(*)
        FROM song_likes AS likes
        WHERE likes.song_id = Song.song_id
      )`),
      'likes_count'
    ];

    const fetchSongs = async (ids) => {
      if (ids.length === 0) return [];
      return await Song.findAll({
        where: { song_id: ids, status: 'published' },
        paranoid: false,
        include: [
          { model: ArtistProfile, attributes: ["stage_name"] },
          { model: Album, attributes: ["title"] }
        ],
        attributes: { include: [likesCountCol] }
      });
    };

    const [weeklyTrending, monthlyTrending, mostPlayed, mostLiked, recentlyReleased] = await Promise.all([
      fetchSongs(weeklyIds),
      fetchSongs(monthlyIds),
      Song.findAll({
        where: { status: 'published' },
        paranoid: false,
        include: [{ model: ArtistProfile, attributes: ["stage_name"] }],
        order: [['play_count', 'DESC']],
        limit: 10
      }),
      Song.findAll({
        where: { status: 'published' },
        paranoid: false,
        include: [{ model: ArtistProfile, attributes: ["stage_name"] }],
        attributes: { include: [likesCountCol] },
        order: [[Sequelize.literal('likes_count'), 'DESC']],
        limit: 10
      }),
      Song.findAll({
        where: { status: 'published' },
        paranoid: false,
        include: [{ model: ArtistProfile, attributes: ["stage_name"] }],
        order: [['release_date', 'DESC'], ['created_at', 'DESC']],
        limit: 10
      })
    ]);

    const resultData = {
      weeklyTrending,
      monthlyTrending,
      mostPlayed,
      mostLiked,
      recentlyReleased
    };

    // Cache computed trending aggregate
    cacheService.set(cacheKey, resultData, 60, ['trending', 'songs']);

    res.json({
      success: true,
      data: resultData
    });
  } catch (err) {
    console.error("[getTrendingContent Error]:", err);
    res.status(500).json({ success: false, message: "Failed to load trending content." });
  }
};

/** ---------------------------------------------------------------
 * ADMIN/ARTIST ENDPOINTS – with automatic cache invalidation
 * --------------------------------------------------------------- */
exports.createAlbum = async (req, res) => {
  try {
    const role = await Role.findByPk(req.user.role_id);
    let artistProfileId = req.body.artist_profile_id;
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile) return res.status(404).json({ success: false, message: "Artist profile not found" });
      artistProfileId = profile.artist_profile_id;
    }
    const { title, description, release_date, status, scheduled_for } = req.body;
    let cover_image = req.body.cover_image;
    if (req.file) {
      cover_image = mediaService.getFileUrl(req.file.filename);
    }

    let computedStatus = status || 'draft';
    if (req.body.is_published !== undefined) computedStatus = req.body.is_published ? 'published' : 'draft';

    const album = await Album.create({ 
      artist_profile_id: artistProfileId, 
      title, 
      description, 
      cover_image, 
      release_date,
      status: computedStatus,
      scheduled_for: scheduled_for || null
    });

    cacheService.invalidateTag('albums');
    res.status(201).json({ success: true, album });
  } catch (err) {
    console.error("[createAlbum Error]:", err);
    res.status(500).json({ success: false, message: "Failed to create album." });
  }
};

exports.updateAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const album = await Album.findByPk(id);
    if (!album) return res.status(404).json({ success: false, message: "Album not found" });

    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || album.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot modify another artist's album" });
      }
    }

    const { title, description, release_date, status, scheduled_for } = req.body;
    let cover_image = req.body.cover_image;
    if (req.file) {
      cover_image = mediaService.getFileUrl(req.file.filename);
    }

    const updateData = { title, description, release_date };
    if (status !== undefined) updateData.status = status;
    if (scheduled_for !== undefined) updateData.scheduled_for = scheduled_for;
    if (req.body.is_published !== undefined) updateData.status = req.body.is_published ? 'published' : 'draft';
    if (cover_image !== undefined) updateData.cover_image = cover_image;

    const oldCover = album.cover_image;
    await album.update(updateData);
    if (updateData.cover_image && updateData.cover_image !== oldCover) {
      await mediaService.deleteFileByUrl(oldCover);
    }

    cacheService.invalidateTag('albums');
    res.json({ success: true, album });
  } catch (err) {
    console.error("[updateAlbum Error]:", err);
    res.status(500).json({ success: false, message: "Failed to update album." });
  }
};

exports.deleteAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const album = await Album.findByPk(id);
    if (!album) return res.status(404).json({ success: false, message: "Album not found" });

    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || album.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete another artist's album" });
      }
    }

    await album.destroy();
    cacheService.invalidateTag('albums');
    res.json({ success: true, message: "Album soft-deleted successfully" });
  } catch (err) {
    console.error("[deleteAlbum Error]:", err);
    res.status(500).json({ success: false, message: "Failed to delete album." });
  }
};

exports.createSong = async (req, res) => {
  try {
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    let artistProfileId = req.body.artist_profile_id;
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile) return res.status(404).json({ success: false, message: "Artist profile not found" });
      artistProfileId = profile.artist_profile_id;
    }
    const songData = { ...req.body, artist_profile_id: artistProfileId };
    if (!songData.status) songData.status = 'draft';
    if (songData.is_published !== undefined) {
      songData.status = songData.is_published ? 'published' : 'draft';
      delete songData.is_published;
    }
    
    const song = await Song.create(songData);

    // Invalidate caches
    cacheService.invalidateTag('songs');
    cacheService.invalidateTag('trending');

    // Notify followers
    if (artistProfileId && songData.status === 'published') {
      const profile = await ArtistProfile.findByPk(artistProfileId);
      const followers = await ArtistFollower.findAll({
        where: { artist_profile_id: artistProfileId }
      });

      if (followers.length > 0) {
        const notificationsToCreate = followers.map(f => ({
          id: "notif_song_" + song.song_id + "_" + f.user_id + "_" + Date.now(),
          user_id: f.user_id,
          type: "song",
          target_id: song.song_id,
          title: "New Song Uploaded!",
          message: `${profile?.stage_name || "Followed Artist"} uploaded a new song: "${song.title}"`,
          timestamp: new Date().toISOString(),
          read: false,
          cleared: false
        }));
        await Notification.bulkCreate(notificationsToCreate);
      }
    }

    res.status(201).json({ success: true, song });
  } catch (err) {
    console.error("[createSong Error]:", err);
    res.status(500).json({ success: false, message: "Failed to create song." });
  }
};

exports.updateSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: "Song not found" });

    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot modify another artist's song" });
      }
    }

    const updateData = { ...req.body };
    if (updateData.is_published !== undefined) {
      updateData.status = updateData.is_published ? 'published' : 'draft';
      delete updateData.is_published;
    }
    const oldAudio = song.audio_file;
    const oldCover = song.cover_image;
    
    await song.update(updateData);

    if (updateData.audio_file && updateData.audio_file !== oldAudio) {
      await mediaService.deleteFileByUrl(oldAudio);
    }
    if (updateData.cover_image && updateData.cover_image !== oldCover) {
      await mediaService.deleteFileByUrl(oldCover);
    }

    cacheService.invalidateTag('songs');
    cacheService.invalidateTag('trending');
    res.json({ success: true, song });
  } catch (err) {
    console.error("[updateSong Error]:", err);
    res.status(500).json({ success: false, message: "Failed to update song." });
  }
};

exports.deleteSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: "Song not found" });

    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role && role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete another artist's song" });
      }
    }

    await song.destroy();
    cacheService.invalidateTag('songs');
    cacheService.invalidateTag('trending');
    res.json({ success: true, message: "Song soft-deleted successfully" });
  } catch (err) {
    console.error("[deleteSong Error]:", err);
    res.status(500).json({ success: false, message: "Failed to delete song." });
  }
};

exports.restoreDeletedSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id, { paranoid: false });
    if (!song) return res.status(404).json({ success: false, message: "Song not found" });

    const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
    if (song.artist_profile_id != profile?.artist_profile_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await song.restore();
    cacheService.invalidateTag('songs');
    cacheService.invalidateTag('trending');
    res.json({ success: true, message: "Song restored successfully" });
  } catch (err) {
    console.error("[restoreDeletedSong Error]:", err);
    res.status(500).json({ success: false, message: "Failed to restore song." });
  }
};

exports.listDeletedSongs = async (req, res) => {
  try {
    const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: "Artist profile not found" });
    
    const songs = await Song.findAll({
      where: {
        artist_profile_id: profile.artist_profile_id,
        deleted_at: { [Op.ne]: null }
      },
      paranoid: false
    });
    res.json({ success: true, songs });
  } catch (err) {
    console.error("[listDeletedSongs Error]:", err);
    res.status(500).json({ success: false, message: "Failed to list deleted songs." });
  }
};

exports.restoreDeletedAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const album = await Album.findByPk(id, { paranoid: false });
    if (!album) return res.status(404).json({ success: false, message: "Album not found" });

    const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
    if (album.artist_profile_id != profile?.artist_profile_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await album.restore();
    cacheService.invalidateTag('albums');
    res.json({ success: true, message: "Album restored successfully" });
  } catch (err) {
    console.error("[restoreDeletedAlbum Error]:", err);
    res.status(500).json({ success: false, message: "Failed to restore album." });
  }
};

exports.listDeletedAlbums = async (req, res) => {
  try {
    const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: "Artist profile not found" });

    const albums = await Album.findAll({
      where: {
        artist_profile_id: profile.artist_profile_id,
        deleted_at: { [Op.ne]: null }
      },
      paranoid: false
    });
    res.json({ success: true, albums });
  } catch (err) {
    console.error("[listDeletedAlbums Error]:", err);
    res.status(500).json({ success: false, message: "Failed to list deleted albums." });
  }
};

exports.listDraftSongs = async (req, res) => {
  try {
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    let whereClause = { status: 'draft' };
    if (role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
      whereClause.artist_profile_id = profile.artist_profile_id;
    }
    const drafts = await Song.findAll({ where: whereClause, include: [{ model: Album, attributes: ['title'] }, { model: Category, attributes: ['name'] }] });
    res.json({ success: true, drafts });
  } catch (err) {
    console.error("[listDraftSongs Error]:", err);
    res.status(500).json({ success: false, message: "Failed to list draft songs." });
  }
};

exports.createDraftSong = async (req, res) => {
  try {
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    let artistProfileId = req.body.artist_profile_id;
    if (role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile) return res.status(404).json({ success: false, message: 'Artist profile not found' });
      artistProfileId = profile.artist_profile_id;
    }
    const songData = { ...req.body, artist_profile_id: artistProfileId, status: 'draft' };
    const song = await Song.create(songData);
    res.status(201).json({ success: true, song });
  } catch (err) {
    console.error("[createDraftSong Error]:", err);
    res.status(500).json({ success: false, message: "Failed to create draft song." });
  }
};

exports.updateDraftSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    if (song.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft songs can be updated via this endpoint' });
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot modify another artist's draft song" });
      }
    }
    const updateData = { ...req.body };
    await song.update(updateData);
    res.json({ success: true, song });
  } catch (err) {
    console.error("[updateDraftSong Error]:", err);
    res.status(500).json({ success: false, message: "Failed to update draft song." });
  }
};

exports.deleteDraftSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    if (song.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft songs can be deleted via this endpoint' });
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete another artist's draft song" });
      }
    }
    await song.destroy();
    res.json({ success: true, message: 'Draft song soft-deleted' });
  } catch (err) {
    console.error("[deleteDraftSong Error]:", err);
    res.status(500).json({ success: false, message: "Failed to delete draft song." });
  }
};

exports.publishDraftSong = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    if (song.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft songs can be published via this endpoint' });
    const roleId = await User.findByPk(req.user.id).then(u => u?.role_id);
    const role = await Role.findByPk(roleId);
    if (role.role_name === 'Artist') {
      const profile = await ArtistProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile || song.artist_profile_id != profile.artist_profile_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot publish another artist's draft song" });
      }
    }
    await song.update({ status: 'published', scheduled_for: null });
    cacheService.invalidateTag('songs');
    cacheService.invalidateTag('trending');
    res.json({ success: true, song });
  } catch (err) {
    console.error("[publishDraftSong Error]:", err);
    res.status(500).json({ success: false, message: "Failed to publish draft song." });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);
    cacheService.invalidateTag('categories');
    res.status(201).json({ success: true, category });
  } catch (err) {
    console.error("[createCategory Error]:", err);
    res.status(500).json({ success: false, message: "Failed to create category." });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await Category.update(req.body, { where: { category_id: id } });
    if (rows === 0) return res.status(404).json({ success: false, message: "Category not found" });
    const category = await Category.findByPk(id);
    cacheService.invalidateTag('categories');
    res.json({ success: true, category });
  } catch (err) {
    console.error("[updateCategory Error]:", err);
    res.status(500).json({ success: false, message: "Failed to update category." });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await Category.destroy({ where: { category_id: id } });
    if (!rows) return res.status(404).json({ success: false, message: "Category not found" });
    cacheService.invalidateTag('categories');
    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    console.error("[deleteCategory Error]:", err);
    res.status(500).json({ success: false, message: "Failed to delete category." });
  }
};

exports.getFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.findAll({
      include: [
        {
          model: Song,
          paranoid: false,
          attributes: ["title", "cover_image"]
        }
      ],
      limit: 100
    });
    const formatted = feedbacks.map(f => {
      const json = f.toJSON();
      json.song_title = f.Song ? f.Song.title : "";
      return json;
    });
    res.json({ success: true, feedbacks: formatted });
  } catch (err) {
    console.error("[getFeedbacks Error]:", err);
    res.status(500).json({ success: false, message: "Failed to retrieve feedbacks." });
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    const { id, song_id, rating, comment } = req.body;
    if (!song_id) return res.status(400).json({ success: false, message: "song_id is required" });

    const user = await User.findByPk(req.user.id);
    const username = user ? user.username : "Anonymous Listener";
    
    const feedback = await Feedback.create({
      id: id || ("feed_" + Date.now()),
      song_id,
      user_id: req.user.id,
      username,
      rating: rating || 5,
      comment: comment || "",
      timestamp: new Date().toISOString(),
      edited: false,
      likes: 0,
      liked_by: []
    });
    
    const songObj = await Song.findByPk(song_id);
    const formatted = feedback.toJSON();
    formatted.song_title = songObj ? songObj.title : "";

    res.status(201).json({ success: true, feedback: formatted });
  } catch (err) {
    console.error("[submitFeedback Error]:", err);
    res.status(500).json({ success: false, message: "Failed to submit feedback." });
  }
};

exports.updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const feedback = await Feedback.findByPk(id);
    if (!feedback) return res.status(404).json({ success: false, message: "Feedback not found" });

    if (feedback.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await feedback.update({
      rating,
      comment,
      edited: true,
    });

    const songObj = await Song.findByPk(feedback.song_id);
    const formatted = feedback.toJSON();
    formatted.song_title = songObj ? songObj.title : "";

    res.json({ success: true, feedback: formatted });
  } catch (err) {
    console.error("[updateFeedback Error]:", err);
    res.status(500).json({ success: false, message: "Failed to update feedback." });
  }
};

exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findByPk(id);
    if (!feedback) return res.status(404).json({ success: false, message: "Feedback not found" });

    if (feedback.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await feedback.destroy();
    res.json({ success: true, message: "Feedback deleted" });
  } catch (err) {
    console.error("[deleteFeedback Error]:", err);
    res.status(500).json({ success: false, message: "Failed to delete feedback." });
  }
};

exports.toggleLikeFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findByPk(id);
    if (!feedback) return res.status(404).json({ success: false, message: "Feedback not found" });

    const userId = req.user.id;
    let likedBy = feedback.liked_by || [];
    const index = likedBy.indexOf(userId);
    if (index === -1) {
      likedBy.push(userId);
    } else {
      likedBy.splice(index, 1);
    }

    await feedback.update({
      liked_by: likedBy,
      likes: likedBy.length
    });

    res.json({ success: true, likes: feedback.likes, likedBy });
  } catch (err) {
    console.error("[toggleLikeFeedback Error]:", err);
    res.status(500).json({ success: false, message: "Failed to toggle feedback like." });
  }
};

module.exports = {
  browseArtists: exports.browseArtists,
  browseAlbums: exports.browseAlbums,
  browseSongs: exports.browseSongs,
  browseCategories: exports.browseCategories,
  getTrendingContent: exports.getTrendingContent,
  createAlbum: exports.createAlbum,
  updateAlbum: exports.updateAlbum,
  deleteAlbum: exports.deleteAlbum,
  createSong: exports.createSong,
  updateSong: exports.updateSong,
  deleteSong: exports.deleteSong,
  restoreDeletedSong: exports.restoreDeletedSong,
  listDeletedSongs: exports.listDeletedSongs,
  restoreDeletedAlbum: exports.restoreDeletedAlbum,
  listDeletedAlbums: exports.listDeletedAlbums,
  createCategory: exports.createCategory,
  updateCategory: exports.updateCategory,
  deleteCategory: exports.deleteCategory,
  getFeedbacks: exports.getFeedbacks,
  submitFeedback: exports.submitFeedback,
  updateFeedback: exports.updateFeedback,
  deleteFeedback: exports.deleteFeedback,
  toggleLikeFeedback: exports.toggleLikeFeedback,
  listDraftSongs: exports.listDraftSongs,
  createDraftSong: exports.createDraftSong,
  updateDraftSong: exports.updateDraftSong,
  deleteDraftSong: exports.deleteDraftSong,
  publishDraftSong: exports.publishDraftSong,
};
