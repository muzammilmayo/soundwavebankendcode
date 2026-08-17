// backend/src/routes/catalogRoutes.js

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/permissionMiddleware');
const catalogController = require('../controllers/catalogController');
const artistModeratorMiddleware = require('../middleware/artistModeratorMiddleware');
const { searchLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const RequestValidator = require('../validators');

// Middleware to allow Admins, Super Admins, and Artists to perform catalog operations
const checkArtistOrAdmin = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      const { User, Role, ArtistModerator } = require('../models');
      
      const userRecord = await User.findByPk(user.id);
      if (!userRecord || !userRecord.role_id) {
        return res.status(403).json({ success: false, message: 'Forbidden: no role assigned' });
      }
      
      const role = await Role.findByPk(userRecord.role_id);
      if (!role) {
        return res.status(403).json({ success: false, message: 'Forbidden: role not found' });
      }
      
      if (role.role_name === 'Admin' || role.role_name === 'Super Admin' || role.role_name === 'Artist') {
        return next();
      }
      
      const moderator = await ArtistModerator.findOne({
        where: { user_id: user.id, status: 'active' }
      });
      if (moderator) {
        return next();
      }

      const perms = await role.getPermissions();
      const has = perms.some(p => p.permission_name === requiredPermission);
      if (!has) {
        return res.status(403).json({ success: false, message: 'Forbidden: missing permission' });
      }
      return next();
    } catch (err) {
      console.error("[checkArtistOrAdmin Error]:", err);
      return res.status(500).json({ success: false, message: 'Server error verifying permissions' });
    }
  };
};

// ---------------- Public browsing (Protected with searchLimiter) ----------------
router.get('/artists', searchLimiter, catalogController.browseArtists);
router.get('/albums', searchLimiter, catalogController.browseAlbums);
router.get('/songs', searchLimiter, catalogController.browseSongs);
router.get('/categories', catalogController.browseCategories);
router.get('/trending', catalogController.getTrendingContent);

const imageUpload = require('../middleware/imageUploadMiddleware');

// ---------------- Protected Album/Song Operations ----------------
router.post('/albums', verifyToken, uploadLimiter, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), imageUpload.single('cover_image'), catalogController.createAlbum);
router.put('/albums/:id', verifyToken, uploadLimiter, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), imageUpload.single('cover_image'), catalogController.updateAlbum);
router.delete('/albums/:id', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.deleteAlbum);

// Soft Delete Listings and Restore for Artists
router.get('/songs/deleted', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.listDeletedSongs);
router.post('/songs/:id/restore', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.restoreDeletedSong);
router.get('/albums/deleted', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.listDeletedAlbums);
router.post('/albums/:id/restore', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.restoreDeletedAlbum);

router.post('/songs', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.createSong);
router.put('/songs/:id', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.updateSong);
router.delete('/songs/:id', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.deleteSong);

// Draft Songs Endpoints
router.get('/songs/drafts', verifyToken, artistModeratorMiddleware, catalogController.listDraftSongs);
router.post('/songs/draft', verifyToken, artistModeratorMiddleware, catalogController.createDraftSong);
router.put('/songs/draft/:id', verifyToken, artistModeratorMiddleware, catalogController.updateDraftSong);
router.delete('/songs/draft/:id', verifyToken, artistModeratorMiddleware, catalogController.deleteDraftSong);
router.post('/songs/draft/:id/publish', verifyToken, artistModeratorMiddleware, catalogController.publishDraftSong);

// Category Operations (Admin only)
router.post('/categories', verifyToken, checkPermission('manage_catalog'), catalogController.createCategory);
router.put('/categories/:id', verifyToken, checkPermission('manage_catalog'), catalogController.updateCategory);
router.delete('/categories/:id', verifyToken, checkPermission('manage_catalog'), catalogController.deleteCategory);

// Feedback Operations
router.get('/feedbacks', catalogController.getFeedbacks);
router.post('/feedbacks', verifyToken, catalogController.submitFeedback);
router.put('/feedbacks/:id', verifyToken, catalogController.updateFeedback);
router.delete('/feedbacks/:id', verifyToken, catalogController.deleteFeedback);
router.post('/feedbacks/:id/like', verifyToken, catalogController.toggleLikeFeedback);

module.exports = router;
