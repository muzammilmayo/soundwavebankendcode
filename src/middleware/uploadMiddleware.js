// src/middleware/uploadMiddleware.js
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

// Define storage location and filename generation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store uploads in a dedicated folder within the project root
    const uploadPath = path.resolve(__dirname, '../../uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate a random hex string plus original extension for uniqueness
    const ext = path.extname(file.originalname);
    const filename = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, filename);
  }
});

// File filter – allow only audio files (mp3, wav, flac, etc.)
const fileFilter = (req, file, cb) => {
  const allowed = /\.(mp3|wav|flac|aac|m4a)$/i;
  if (allowed.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

// Export configured multer instance
const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

module.exports = upload;
