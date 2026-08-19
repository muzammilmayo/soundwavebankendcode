// src/controllers/lyricsController.js
// REST API endpoints for the lyrics system.
//
// GET    /api/lyrics/songs/:id           → get lyrics + status for a song
// GET    /api/lyrics/songs/:id/status    → check processing status
// PUT    /api/lyrics/songs/:id           → artist saves edited lyrics
// POST   /api/lyrics/songs/:id/generate   → queue a new Whisper job
// POST   /api/lyrics/songs/:id/regenerate → queue a new Whisper job

const { Song, ArtistProfile } = require('../models');
const { lyricsQueue } = require('../queues/lyricsQueue');

// ── Helper: verify the requesting user owns this song ─────────────────────────
// NOTE: artistModeratorMiddleware (on the route) already sets req.user.artistProfileId
// and validates ownership. This is a safety net for extra validation.
function assertOwnership(req, song) {
  // artistModeratorMiddleware sets req.user.artistProfileId
  const userArtistProfileId = req.user.artistProfileId;

  if (!userArtistProfileId) {
    const err = new Error('Forbidden: no artist profile context found');
    err.status = 403;
    throw err;
  }

  if (parseInt(song.artist_profile_id) !== parseInt(userArtistProfileId)) {
    const err = new Error('Forbidden: you do not own this song');
    err.status = 403;
    throw err;
  }
}

// ── GET /api/lyrics/songs/:id ─────────────────────────────────────────────────
// Returns the current lyrics payload for a song.
// Open to any authenticated user (listeners need to see completed lyrics).
exports.getLyrics = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id, {
      attributes: ['song_id', 'title', 'lyrics', 'lyrics_status', 'lyrics_error', 'lyrics_job_id', 'audio_file', 'updated_at'],
    });

    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    // Auto-heal stuck 'processing' jobs older than 10 minutes
    if (song.lyrics_status === 'processing') {
      const updatedAt = new Date(song.updated_at).getTime();
      const now = Date.now();
      if (now - updatedAt > 10 * 60 * 1000) {
        await song.update({
          lyrics_status: 'failed',
          lyrics_error: 'Transcription timed out. Please click Retry.',
        });
      }
    }

    // Auto-enqueue job if status is pending/none but no job was queued yet
    if ((song.lyrics_status === 'pending' || song.lyrics_status === 'none') && !song.lyrics_job_id && song.audio_file) {
      try {
        const job = await lyricsQueue.add('generate-lyrics', { songId: song.song_id });
        await song.update({ lyrics_status: 'pending', lyrics_job_id: String(job.id) });
        console.log(`[lyricsController] Auto-queued job ${job.id} for song ${song.song_id}`);
      } catch (qErr) {
        console.warn('[lyricsController] Failed to auto-queue job:', qErr.message);
      }
    }

    res.json({
      success: true,
      data: {
        song_id: song.song_id,
        title: song.title,
        lyrics: song.lyrics || null,
        lyrics_status: song.lyrics_status,
        lyrics_error: song.lyrics_error || null,
        lyrics_job_id: song.lyrics_job_id || null,
      },
    });
  } catch (err) {
    console.error('[getLyrics Error]:', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to get lyrics' });
  }
};

// ── GET /api/lyrics/songs/:id/status ──────────────────────────────────────────
// Returns quick status for frontend polling
exports.getLyricsStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id, {
      attributes: ['song_id', 'lyrics', 'lyrics_status', 'lyrics_error', 'updated_at'],
    });

    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    // Auto-heal stuck 'processing' status older than 10 mins
    if (song.lyrics_status === 'processing') {
      const updatedAt = new Date(song.updated_at).getTime();
      const now = Date.now();
      if (now - updatedAt > 10 * 60 * 1000) {
        await song.update({
          lyrics_status: 'failed',
          lyrics_error: 'Transcription timed out. Please click Retry.',
        });
      }
    }

    res.json({
      success: true,
      status: song.lyrics_status,
      lyrics: song.lyrics || null,
      error: song.lyrics_error || null,
    });
  } catch (err) {
    console.error('[getLyricsStatus Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch status' });
  }
};

// ── PUT /api/lyrics/songs/:id ─────────────────────────────────────────────────
// Artist saves edited (manually corrected) lyrics.
// Body: { lyrics: string }
exports.saveLyrics = async (req, res) => {
  try {
    const { id } = req.params;
    const { lyrics } = req.body;

    if (typeof lyrics !== 'string') {
      return res.status(400).json({ success: false, message: 'lyrics must be a string' });
    }

    const song = await Song.findByPk(id);
    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    await assertOwnership(req, song);

    await song.update({
      lyrics: lyrics.trim(),
      lyrics_status: 'completed',
      lyrics_error: null,
    });

    res.json({ success: true, message: 'Lyrics saved successfully', data: { lyrics: song.lyrics } });
  } catch (err) {
    console.error('[saveLyrics Error]:', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to save lyrics' });
  }
};

// ── POST /api/lyrics/songs/:id/regenerate ─────────────────────────────────────
// Artist requests a fresh Whisper transcription.
// Resets status to 'pending' and enqueues a new job.
exports.regenerateLyrics = async (req, res) => {
  try {
    const { id } = req.params;
    const song = await Song.findByPk(id);

    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    await assertOwnership(req, song);

    if (!song.audio_file) {
      return res.status(400).json({ success: false, message: 'Song has no audio file for transcription' });
    }

    // Reset status and clear any previous errors
    await song.update({
      lyrics_status: 'pending',
      lyrics_error: null,
    });

    // Enqueue a new BullMQ job
    const job = await lyricsQueue.add('generate-lyrics', { songId: song.song_id });

    // Persist the job ID for tracking
    await song.update({ lyrics_job_id: String(job.id) });

    console.log(`[lyricsController] Regenerate queued: song=${song.song_id}, job=${job.id}`);

    res.json({
      success: true,
      message: 'Lyrics regeneration queued',
      data: { lyrics_status: 'pending', lyrics_job_id: job.id },
    });
  } catch (err) {
    console.error('[regenerateLyrics Error]:', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to queue regeneration' });
  }
};
