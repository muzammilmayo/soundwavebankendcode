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

module.exports = {
  getUploadsDir,
  getFileUrl,
  ensureUploadsDir,
};
