// backend/src/services/mediaService.js

/**
 * Media Service utilities for handling uploaded media files.
 * This module provides helper functions to generate unique filenames
 * and to construct file URLs for serving uploaded content.
 */
const path = require('path');
const fs = require('fs');

/**
 * Returns the absolute path to the uploads directory.
 * @returns {string}
 */
function getUploadsDir() {
  // Resolve relative to project root (backend directory)
  return path.resolve(__dirname, '../uploads');
}

function getFileUrl(filename) {
  const host = process.env.BACKEND_URL || 'http://localhost:5000';
  return `${host}/uploads/${filename}`;
}

/**
 * Ensures the uploads directory exists, creating it if necessary.
 */
function ensureUploadsDir() {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
/**
 * Deletes a file from the server's uploads folder if it is no longer referenced anywhere else.
 * Handles both relative/absolute paths and full URLs.
 * @param {string} fileUrlOrPath - The file path or full URL of the uploaded asset.
 * @param {object} [excludeOptions] - Optional. Exclude checking this specific entity to avoid self-matches during updates/deletes.
 * @param {string} [excludeOptions.model] - 'Song', 'Album', or 'User'
 * @param {number} [excludeOptions.id] - The primary key ID to exclude
 */
async function deleteFileByUrl(fileUrlOrPath, excludeOptions = null) {
  if (!fileUrlOrPath) return;

  try {
    let filename = fileUrlOrPath;
    if (fileUrlOrPath.includes('/uploads/')) {
      filename = fileUrlOrPath.split('/uploads/')[1];
    } else {
      filename = path.basename(fileUrlOrPath);
    }

    if (!filename) return;

    const filePath = path.join(getUploadsDir(), filename);
    if (!fs.existsSync(filePath)) {
      console.log(`[MediaService] File does not exist on disk: ${filePath}`);
      return;
    }

    // Dynamic import to prevent circular dependency
    const { Song, Album, User } = require('../models');
    const { Op } = require('sequelize');

    // Build conditions checking if this filename/URL is used in database
    const songAudioWhere = { audio_file: { [Op.like]: `%${filename}%` } };
    const songCoverWhere = { cover_image: { [Op.like]: `%${filename}%` } };
    const albumCoverWhere = { cover_image: { [Op.like]: `%${filename}%` } };
    const userAvatarWhere = { avatar: { [Op.like]: `%${filename}%` } };

    // Exclude the current updating/deleting record if requested
    if (excludeOptions) {
      const { model, id } = excludeOptions;
      if (model === 'Song') {
        songAudioWhere.song_id = { [Op.ne]: id };
        songCoverWhere.song_id = { [Op.ne]: id };
      } else if (model === 'Album') {
        albumCoverWhere.album_id = { [Op.ne]: id };
      } else if (model === 'User') {
        userAvatarWhere.user_id = { [Op.ne]: id };
      }
    }

    const [songAudioCount, songCoverCount, albumCoverCount, userAvatarCount] = await Promise.all([
      Song.count({ where: songAudioWhere }),
      Song.count({ where: songCoverWhere }),
      Album.count({ where: albumCoverWhere }),
      User.count({ where: userAvatarWhere })
    ]);

    const totalUsage = songAudioCount + songCoverCount + albumCoverCount + userAvatarCount;
    if (totalUsage === 0) {
      fs.unlinkSync(filePath);
      console.log(`[MediaService] Successfully unlinked orphaned asset: ${filename}`);
    } else {
      console.log(`[MediaService] Asset ${filename} is still referenced in DB (usage count: ${totalUsage}). Skipping unlink.`);
    }
  } catch (err) {
    console.error(`[MediaService] Error unlinking file ${fileUrlOrPath}:`, err);
  }
}

module.exports = {
  getUploadsDir,
  getFileUrl,
  ensureUploadsDir,
  deleteFileByUrl,
};

