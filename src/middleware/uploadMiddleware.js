// src/middleware/uploadMiddleware.js
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

// Define storage location and filename generation
const fs = require('fs');

// Define storage location and filename generation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subfolder = 'covers';
    const urlPath = (req.baseUrl + req.path).toLowerCase();
    
    if (file.fieldname === 'audio') {
      subfolder = 'songs';
    } else if (file.fieldname === 'avatar' || urlPath.includes('avatar') || urlPath.includes('profile')) {
      subfolder = 'avatars';
    } else if (urlPath.includes('artist')) {
      subfolder = 'artists';
    } else if (urlPath.includes('album')) {
      subfolder = 'albums';
    }
    
    const uploadPath = path.resolve(__dirname, '../uploads', subfolder);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate a random hex string plus original extension for uniqueness
    const ext = path.extname(file.originalname);
    const filename = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, filename);
  }
});

// File filter – allow only audio files for 'audio' field, and image files for 'cover_image' field
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'audio') {
    const allowedAudio = /\.(mp3|wav|flac|aac|m4a)$/i;
    if (allowedAudio.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported audio file type'), false);
    }
  } else if (file.fieldname === 'cover_image') {
    const allowedImage = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowedImage.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported image file type'), false);
    }
  } else {
    cb(new Error('Unexpected fieldname: ' + file.fieldname), false);
  }
};

// Configured multer instance
const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

function normalizeReqFiles(req) {
  const normalizeFile = (file) => {
    if (file && file.path) {
      const uploadsDir = path.resolve(__dirname, '../uploads');
      file.filename = path.relative(uploadsDir, file.path).replace(/\\/g, '/');
    }
  };

  if (req.file) {
    normalizeFile(req.file);
  }
  if (req.files) {
    for (const field in req.files) {
      req.files[field].forEach(normalizeFile);
    }
  }
}

module.exports = {
  fields: (fields) => {
    const mw = upload.fields(fields);
    return (req, res, next) => {
      mw(req, res, (err) => {
        if (err) return next(err);
        normalizeReqFiles(req);
        next();
      });
    };
  },
  single: (fieldName) => {
    const mw = upload.single(fieldName);
    return (req, res, next) => {
      mw(req, res, (err) => {
        if (err) return next(err);
        normalizeReqFiles(req);
        next();
      });
    };
  }
};
