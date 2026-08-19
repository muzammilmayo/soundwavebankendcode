// src/routes/lyricsRoutes.js

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const artistModeratorMiddleware = require('../middleware/artistModeratorMiddleware');
const lyricsController = require('../controllers/lyricsController');

// GET  /api/lyrics/songs/:id           — Any authenticated user can fetch lyrics
router.get('/songs/:id', verifyToken, lyricsController.getLyrics);

// GET  /api/lyrics/songs/:id/status    — Check processing status
router.get('/songs/:id/status', verifyToken, lyricsController.getLyricsStatus);

// PUT  /api/lyrics/songs/:id           — Artist/Moderator saves manually edited lyrics
router.put('/songs/:id', verifyToken, artistModeratorMiddleware, lyricsController.saveLyrics);

// POST /api/lyrics/songs/:id/generate   — Enqueue lyrics job
router.post('/songs/:id/generate', verifyToken, artistModeratorMiddleware, lyricsController.regenerateLyrics);

// POST /api/lyrics/songs/:id/regenerate — Re-enqueue lyrics job
router.post('/songs/:id/regenerate', verifyToken, artistModeratorMiddleware, lyricsController.regenerateLyrics);

// ── Aliases for /api/songs/:id/lyrics endpoints ──────────────────────────────
router.get('/:id/lyrics', verifyToken, lyricsController.getLyrics);
router.get('/:id/lyrics/status', verifyToken, lyricsController.getLyricsStatus);
router.post('/:id/lyrics/generate', verifyToken, artistModeratorMiddleware, lyricsController.regenerateLyrics);
router.post('/:id/lyrics/regenerate', verifyToken, artistModeratorMiddleware, lyricsController.regenerateLyrics);
router.put('/:id/lyrics', verifyToken, artistModeratorMiddleware, lyricsController.saveLyrics);

module.exports = router;

