const multer = require("multer");
const path = require("path");

const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subfolder = 'covers';
    const urlPath = (req.baseUrl + req.path).toLowerCase();
    
    if (urlPath.includes('avatar') || urlPath.includes('profile')) {
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
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const mimeType = allowedTypes.test(file.mimetype);
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimeType && extName) {
    return cb(null, true);
  }
  cb(new Error("Only images (.jpg, .jpeg, .png, .webp) are allowed!"));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});

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
