// src/workers/lyricsWorker.js
// ─────────────────────────────────────────────────────────────────────────────
// STANDALONE PROCESS — run separately from the Express server:
//   npm run worker   (or node workers/lyricsWorker.js)
//
// This worker:
//   1. Listens to the 'lyrics-generation' BullMQ queue.
//   2. Receives a { songId } job payload.
//   3. Fetches the Song record from MySQL (Sequelize).
//   4. Reads the audio file from disk (uploads/songs/<filename>).
//   5. Runs the local Python script (src/scripts/transcribe.py):
//      - Demucs isolates vocals from background music/instruments.
//      - faster-whisper transcribes vocals and auto-detects language.
//      - Translates non-English lyrics to English.
//      - Cleans hallucinations and formats readable song stanzas.
//   6. Validates English-only output and sets lyrics_status = 'completed'.
//   7. On failure: sets lyrics_status = 'failed' and saves the error message.
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Worker } = require('bullmq');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// ── Bootstrap Sequelize / DB connection ──────────────────────────────────────
require('../config/db');
const { Song } = require('../models');

// ── Redis connection ─────────────────────────────────────────────────────────
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
};

// ── Uploads & Script directory ────────────────────────────────────────────────
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
const TRANSCRIBE_SCRIPT = path.resolve(__dirname, '../scripts/transcribe.py');

function getPythonExecutable() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  const localAppData = process.env.LOCALAPPDATA || '';
  const userProfile = process.env.USERPROFILE || '';
  const candidates = [
    path.join(__dirname, '../venv/Scripts/python.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python312', 'python.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python310', 'python.exe'),
    'C:\\Python311\\python.exe',
    'C:\\Python312\\python.exe',
    path.join(userProfile, '.venvs', 'soundwave', 'Scripts', 'python.exe'),
    process.env.PYTHON_PATH || 'python',
  ];
  for (const cand of candidates) {
    if (cand === 'python' || cand === 'py') continue;
    if (fs.existsSync(cand)) return cand;
  }
  return process.env.PYTHON_PATH || 'python';
}

const PYTHON_PATH = getPythonExecutable();

// ── Locate FFmpeg Bin Directory if available ──────────────────────────────────
function getFFmpegDir() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const wingetPkg = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(wingetPkg)) {
    const entries = fs.readdirSync(wingetPkg);
    for (const e of entries) {
      if (e.toLowerCase().includes('ffmpeg')) {
        const binCand = path.join(wingetPkg, e, 'ffmpeg-8.1.1-essentials_build', 'bin');
        if (fs.existsSync(path.join(binCand, 'ffmpeg.exe'))) return binCand;
        const subBin = path.join(wingetPkg, e, 'bin');
        if (fs.existsSync(path.join(subBin, 'ffmpeg.exe'))) return subBin;
      }
    }
  }
  return null;
}

const FFMPEG_BIN = getFFmpegDir();


// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveAudioPath(audioFile) {
  if (!audioFile) return null;
  const directPath = path.join(UPLOADS_DIR, audioFile);
  if (fs.existsSync(directPath)) return directPath;

  const songsSubfolderPath = path.join(UPLOADS_DIR, 'songs', path.basename(audioFile));
  if (fs.existsSync(songsSubfolderPath)) return songsSubfolderPath;

  const rootUploadsPath = path.join(UPLOADS_DIR, path.basename(audioFile));
  if (fs.existsSync(rootUploadsPath)) return rootUploadsPath;

  return directPath;
}

/**
 * Validates that lyrics are in English / Latin alphabet characters.
 */
function isEnglishText(text) {
  if (!text || !text.trim()) return false;
  let latinChars = 0;
  let totalAlpha = 0;
  for (const char of text) {
    if (/[a-zA-Z]/.test(char)) {
      latinChars++;
      totalAlpha++;
    } else if (/\p{L}/u.test(char)) {
      totalAlpha++;
    }
  }
  if (totalAlpha === 0) return true;
  return (latinChars / totalAlpha) >= 0.80;
}

/**
 * Invokes local Python transcribe.py script and returns the parsed JSON output.
 */
function runLocalPipeline(audioPath) {
  return new Promise((resolve, reject) => {
    let pathEnv = process.env.PATH || '';
    if (FFMPEG_BIN && !pathEnv.includes(FFMPEG_BIN)) {
      pathEnv = `${FFMPEG_BIN};${pathEnv}`;
    }

    const env = {
      ...process.env,
      PATH: pathEnv,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };

    execFile(
      PYTHON_PATH,
      [TRANSCRIBE_SCRIPT, audioPath],
      { env, maxBuffer: 30 * 1024 * 1024, timeout: 900000, encoding: 'utf8' }, // 15 min timeout for Demucs + Whisper
      (err, stdout, stderr) => {
        if (err && !stdout) {
          const errMsg = err.message || '';
          if (errMsg.includes('Python was not found') || errMsg.includes('not recognized')) {
            return reject(new Error('Python 3.10+ is not installed or not configured in PYTHON_PATH.'));
          }
          return reject(new Error(`Python execution error: ${errMsg}. ${stderr || ''}`));
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.success === false) {
            return reject(new Error(parsed.error || 'Local lyrics generation pipeline failed'));
          }
          resolve(parsed);
        } catch (jsonErr) {
          if (stdout.includes('Python was not found')) {
            return reject(new Error('Python is not installed or not in PATH.'));
          }
          reject(new Error(`Failed to parse Python output: ${stdout || stderr || jsonErr.message}`));
        }
      }
    );
  });
}


/**
 * Cleans and normalizes transcript text into readable song lyrics.
 */
function formatLyrics(rawText) {
  if (!rawText || !rawText.trim()) return '';
  return rawText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// ── Worker processor ──────────────────────────────────────────────────────────

async function processLyricsJob(job) {
  const { songId } = job.data;
  console.log(`[LyricsWorker] Processing job ${job.id} for songId=${songId}`);

  // Heartbeat interval to renew BullMQ lock during CPU-intensive Demucs & Whisper
  const heartbeat = setInterval(() => {
    job.updateProgress({ timestamp: Date.now() }).catch(() => {});
  }, 10000);

  try {
    // 1. Find the song
    const song = await Song.findByPk(songId);
    if (!song) {
      throw new Error(`Song ${songId} not found in database`);
    }

    if (!song.audio_file) {
      throw new Error(`Song ${songId} has no audio_file path`);
    }

    // 2. Mark as processing
    await song.update({ lyrics_status: 'processing' });
    console.log(`[LyricsWorker] Song ${songId}: status → processing`);

    // 3. Resolve audio file path
    const audioPath = resolveAudioPath(song.audio_file);
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found on disk: ${audioPath}`);
    }

    console.log(`[LyricsWorker] Song ${songId}: running Demucs vocal separation + faster-whisper → ${audioPath}`);

    // 4. Run local Demucs + Whisper + Translation pipeline
    const result = await runLocalPipeline(audioPath);

    // 5. Format transcription text into stanzas
    let lyrics = formatLyrics(result.text);

    if (!lyrics || !lyrics.trim()) {
      lyrics = '[Instrumental Track / No vocal lyrics detected]';
    }

    // 6. English-only validation
    if (lyrics !== '[Instrumental Track / No vocal lyrics detected]') {
      if (!isEnglishText(lyrics)) {
        throw new Error('Lyrics failed English-only validation (non-English characters detected).');
      }
    }

    console.log(`[LyricsWorker] Song ${songId}: transcription complete (Language: ${result.language || 'unknown'}, ${lyrics.length} chars)`);

    // 7. Save lyrics to database and mark completed
    await song.update({
      lyrics,
      lyrics_status: 'completed',
      lyrics_error: null,
    });

    console.log(`[LyricsWorker] Song ${songId}: English lyrics verified and saved ✅`);
    return { songId, language: result.language, lyricsLength: lyrics.length };
  } catch (err) {
    console.error(`[LyricsWorker] Error processing song ${songId}:`, err.message);
    try {
      const song = await Song.findByPk(songId);
      if (song) {
        await song.update({
          lyrics_status: 'failed',
          lyrics_error: err.message || 'Lyrics generation failed',
        });
      }
    } catch (dbErr) {
      console.error('[LyricsWorker] Failed to update error status in DB:', dbErr.message);
    }
    throw err;
  } finally {
    clearInterval(heartbeat);
  }
}

// ── Startup Self-Healing (Recover stuck 'processing' songs) ────────────────────
async function recoverStuckSongs() {
  try {
    const [updated] = await Song.update(
      { lyrics_status: 'failed', lyrics_error: 'Worker restarted while processing. Please retry.' },
      { where: { lyrics_status: 'processing' } }
    );
    if (updated > 0) {
      console.log(`[LyricsWorker] Reset ${updated} orphaned stuck 'processing' song(s) to 'failed'.`);
    }
  } catch (err) {
    console.error('[LyricsWorker] Error resetting stuck songs:', err.message);
  }
}
recoverStuckSongs();

// ── Create Worker ─────────────────────────────────────────────────────────────

const worker = new Worker('lyrics-generation', processLyricsJob, {
  connection,
  concurrency: 1,         // Run 1 local transcription at a time to prevent CPU overload
  lockDuration: 900000,   // 15 minutes lock so BullMQ doesn't mark CPU Demucs/Whisper as stalled
  stalledInterval: 60000, // 60s stalled check interval
  maxStalledCount: 3,
});

worker.on('completed', (job, result) => {
  console.log(`[LyricsWorker] ✅ Job ${job.id} completed:`, result);
});

worker.on('failed', async (job, err) => {
  console.error(`[LyricsWorker] ❌ Job ${job?.id} failed:`, err.message);

  if (job?.data?.songId) {
    try {
      const song = await Song.findByPk(job.data.songId);
      if (song && song.lyrics_status !== 'completed') {
        await song.update({
          lyrics_status: 'failed',
          lyrics_error: err.message || 'Unknown error during local lyrics generation',
        });
      }
    } catch (dbErr) {
      console.error('[LyricsWorker] Failed to update error status in DB:', dbErr.message);
    }
  }
});

let workerRedisWarned = false;
worker.on('error', (err) => {
  if (!workerRedisWarned) {
    console.log('[LyricsWorker] Waiting for Redis/Memurai server on ' + REDIS_HOST + ':' + REDIS_PORT + '...');
    workerRedisWarned = true;
  }
});

console.log('🎵 Lyrics Worker started (Demucs + faster-whisper + English Translator) — listening on queue: lyrics-generation');
console.log(`   Redis: ${REDIS_HOST}:${REDIS_PORT}`);
console.log(`   Whisper Model: ${process.env.WHISPER_MODEL || 'small'}`);
console.log(`   Demucs Model: ${process.env.DEMUCS_MODEL || 'htdemucs'}`);
console.log(`   Python Path: ${PYTHON_PATH}`);


