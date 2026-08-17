// backend/src/routes/catalogRoutes.js

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/permissionMiddleware');
const catalogController = require('../controllers/catalogController');
const artistModeratorMiddleware = require('../middleware/artistModeratorMiddleware');

// Middleware to allow Admins, Super Admins, and Artists to perform catalog operations
const fs = require('fs');
const path = require('path');
const debugLog = (msg) => {
  try {
    fs.appendFileSync(path.join(__dirname, 'debug.txt'), msg + '\n');
  } catch (err) {
    console.error(err);
  }
};

const checkArtistOrAdmin = (requiredPermission) => {
  return (req, res, next) => {
    const user = req.user;
    debugLog(`[checkArtistOrAdmin] Incoming request for /albums. User: ${JSON.stringify(user)}`);
    if (!user) {
      debugLog('[checkArtistOrAdmin] No user on request.');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const { User, Role } = require('../models');
    
    // Always query database to get the latest role assignment
    const roleIdPromise = User.findByPk(user.id).then(u => u?.role_id);

    roleIdPromise
      .then(roleId => {
        debugLog(`[checkArtistOrAdmin] resolved roleId: ${roleId}`);
        if (!roleId) {
          debugLog('[checkArtistOrAdmin] no roleId found.');
          return res.status(403).json({ success: false, message: 'Forbidden: no role assigned' });
        }
        
        return Role.findByPk(roleId).then(role => {
          debugLog(`[checkArtistOrAdmin] resolved role name: ${role?.role_name}`);
          if (!role) {
            debugLog('[checkArtistOrAdmin] Role not found in DB.');
            return res.status(403).json({ success: false, message: 'Forbidden: role not found' });
          }
          
          if (role.role_name === 'Admin' || role.role_name === 'Super Admin' || role.role_name === 'Artist') {
            debugLog('[checkArtistOrAdmin] Role matched Artist/Admin. Allowing.');
            return next();
          }
          
          const { ArtistModerator } = require('../models');
          return ArtistModerator.findOne({
            where: { user_id: user.id, status: 'active' }
          }).then(moderator => {
            if (moderator) {
              debugLog('[checkArtistOrAdmin] User is active artist moderator. Allowing.');
              return next();
            }
            return role.getPermissions().then(perms => {
            const permNames = perms.map(p => p.permission_name);
            debugLog(`[checkArtistOrAdmin] Role permissions: ${JSON.stringify(permNames)}. Required: ${requiredPermission}`);
            const has = perms.some(p => p.permission_name === requiredPermission);
            if (!has) {
              debugLog('[checkArtistOrAdmin] Missing required permission.');
              return res.status(403).json({ success: false, message: 'Forbidden: missing permission' });
            }
            debugLog('[checkArtistOrAdmin] Permission matched. Allowing.');
            next();
          });
        });
      });
    })
    .catch(err => {
        debugLog(`[checkArtistOrAdmin] ERROR: ${err.message}`);
        res.status(500).json({ success: false, message: 'Server error' });
      });
  };
};

// ---------------- Public browsing (no auth needed, but keep optional user context) ----------------
router.get('/artists', catalogController.browseArtists);
router.get('/albums', catalogController.browseAlbums);
router.get('/songs', catalogController.browseSongs);
router.get('/categories', catalogController.browseCategories);
router.get('/trending', catalogController.getTrendingContent);

const imageUpload = require('../middleware/imageUploadMiddleware');

// ---------------- Protected Album/Song Operations ----------------
router.post('/albums', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), imageUpload.single('cover_image'), catalogController.createAlbum);
router.put('/albums/:id', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), imageUpload.single('cover_image'), catalogController.updateAlbum);
router.delete('/albums/:id', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.deleteAlbum);

// Soft Delete Listings and Restore for Artists
router.get('/songs/deleted', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.listDeletedSongs);
router.post('/songs/:id/restore', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.restoreDeletedSong);
router.get('/albums/deleted', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.listDeletedAlbums);
router.post('/albums/:id/restore', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.restoreDeletedAlbum);

router.post('/songs', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.createSong);
router.put('/songs/:id', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.updateSong);
router.delete('/songs/:id', verifyToken, artistModeratorMiddleware, checkArtistOrAdmin('manage_catalog'), catalogController.deleteSong);

// Category Operations (Admin only)

// Draft Songs Endpoints (placeholder handlers)
router.get('/songs/drafts', verifyToken, artistModeratorMiddleware, catalogController.listDraftSongs);
router.post('/songs/draft', verifyToken, artistModeratorMiddleware, catalogController.createDraftSong);
router.put('/songs/draft/:id', verifyToken, artistModeratorMiddleware, catalogController.updateDraftSong);
router.delete('/songs/draft/:id', verifyToken, artistModeratorMiddleware, catalogController.deleteDraftSong);
router.post('/songs/draft/:id/publish', verifyToken, artistModeratorMiddleware, catalogController.publishDraftSong);

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
