// src/queues/lyricsQueue.js
// BullMQ queue for async lyrics generation jobs.
// This module exports a single queue instance used by:
//   - artistController.js  (producer – adds jobs after song upload)
//   - lyricsWorker.js      (consumer – processes jobs via Whisper)

const { Queue } = require('bullmq');

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_URL = process.env.REDIS_URL || `redis://${REDIS_HOST}:${REDIS_PORT}`;

// Parse the Redis URL into a connection config object that BullMQ accepts
function parseRedisUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || REDIS_HOST,
      port: parseInt(parsed.port, 10) || REDIS_PORT,
      password: parsed.password || undefined,
      db: parseInt((parsed.pathname || '/0').replace('/', ''), 10) || 0,
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null };
  }
}

const connection = parseRedisUrl(REDIS_URL);


const lyricsQueue = new Queue('lyrics-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,                  // Retry up to 3 times if Whisper fails
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,        // Keep the last 100 completed jobs
    removeOnFail: 200,            // Keep the last 200 failed jobs
  },
});

let redisWarned = false;
lyricsQueue.on('error', (err) => {
  if (!redisWarned) {
    console.log('[LyricsQueue] Redis is not running on 127.0.0.1:6379. (Start Redis to enable automatic lyrics generation)');
    redisWarned = true;
  }
});

module.exports = { lyricsQueue };


