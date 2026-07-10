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
  return path.resolve(__dirname, '../../uploads');
}

/**
 * Generates a publicly accessible URL for a given filename.
 * Assumes that the Express server serves the `/uploads` folder at `/uploads`.
 * @param {string} filename
 * @returns {string}
 */
function getFileUrl(filename) {
  return `/uploads/${filename}`;
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

module.exports = {
  getUploadsDir,
  getFileUrl,
  ensureUploadsDir,
};
