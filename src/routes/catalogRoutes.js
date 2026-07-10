// backend/src/routes/catalogRoutes.js

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/permissionMiddleware');
const catalogController = require('../controllers/catalogController');

// ---------------- Public browsing (no auth needed, but keep optional user context) ----------------
router.get('/artists', catalogController.browseArtists);
router.get('/albums', catalogController.browseAlbums);
router.get('/songs', catalogController.browseSongs);
router.get('/categories', catalogController.browseCategories);

// ---------------- Admin CRUD – protected ----------------
router.post('/albums', verifyToken, checkPermission('manage_catalog'), catalogController.createAlbum);
router.put('/albums/:id', verifyToken, checkPermission('manage_catalog'), catalogController.updateAlbum);
router.delete('/albums/:id', verifyToken, checkPermission('manage_catalog'), catalogController.deleteAlbum);

router.post('/songs', verifyToken, checkPermission('manage_catalog'), catalogController.createSong);
router.put('/songs/:id', verifyToken, checkPermission('manage_catalog'), catalogController.updateSong);
router.delete('/songs/:id', verifyToken, checkPermission('manage_catalog'), catalogController.deleteSong);

router.post('/categories', verifyToken, checkPermission('manage_catalog'), catalogController.createCategory);
router.put('/categories/:id', verifyToken, checkPermission('manage_catalog'), catalogController.updateCategory);
router.delete('/categories/:id', verifyToken, checkPermission('manage_catalog'), catalogController.deleteCategory);

module.exports = router;
