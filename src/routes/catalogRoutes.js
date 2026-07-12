// backend/src/routes/catalogRoutes.js

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/permissionMiddleware');
const catalogController = require('../controllers/catalogController');

// Middleware to allow Admins, Super Admins, and Artists to perform catalog operations
const checkArtistOrAdmin = (requiredPermission) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const { User, Role } = require('../models');
    
    // Fallback: lookup user in DB if role_id is not in JWT payload
    const roleIdPromise = user.role_id 
      ? Promise.resolve(user.role_id) 
      : User.findByPk(user.id).then(u => u?.role_id);

    roleIdPromise
      .then(roleId => {
        if (!roleId) return res.status(403).json({ success: false, message: 'Forbidden: no role assigned' });
        
        return Role.findByPk(roleId).then(role => {
          if (!role) return res.status(403).json({ success: false, message: 'Forbidden: role not found' });
          
          // Admin, Super Admin, and Artist are allowed to modify the catalog (with ownership checks inside controllers)
          if (role.role_name === 'Admin' || role.role_name === 'Super Admin' || role.role_name === 'Artist') {
            return next();
          }
          
          // Otherwise, verify required permission (e.g. for Moderator)
          return role.getPermissions().then(perms => {
            const has = perms.some(p => p.permission_name === requiredPermission);
            if (!has) return res.status(403).json({ success: false, message: 'Forbidden: missing permission' });
            next();
          });
        });
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
      });
  };
};

// ---------------- Public browsing (no auth needed, but keep optional user context) ----------------
router.get('/artists', catalogController.browseArtists);
router.get('/albums', catalogController.browseAlbums);
router.get('/songs', catalogController.browseSongs);
router.get('/categories', catalogController.browseCategories);

const imageUpload = require('../middleware/imageUploadMiddleware');

// ---------------- Protected Album/Song Operations ----------------
router.post('/albums', verifyToken, checkArtistOrAdmin('manage_catalog'), imageUpload.single('cover_image'), catalogController.createAlbum);
router.put('/albums/:id', verifyToken, checkArtistOrAdmin('manage_catalog'), imageUpload.single('cover_image'), catalogController.updateAlbum);
router.delete('/albums/:id', verifyToken, checkArtistOrAdmin('manage_catalog'), catalogController.deleteAlbum);

router.post('/songs', verifyToken, checkArtistOrAdmin('manage_catalog'), catalogController.createSong);
router.put('/songs/:id', verifyToken, checkArtistOrAdmin('manage_catalog'), catalogController.updateSong);
router.delete('/songs/:id', verifyToken, checkArtistOrAdmin('manage_catalog'), catalogController.deleteSong);

// Category Operations (Admin only)
router.post('/categories', verifyToken, checkPermission('manage_catalog'), catalogController.createCategory);
router.put('/categories/:id', verifyToken, checkPermission('manage_catalog'), catalogController.updateCategory);
router.delete('/categories/:id', verifyToken, checkPermission('manage_catalog'), catalogController.deleteCategory);

module.exports = router;
