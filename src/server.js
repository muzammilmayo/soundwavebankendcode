const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const path = require("path");

dotenv.config();

const app = express();

// 1. HTTP Security Headers (Helmet)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allows media files to be served cross-origin
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // Managed via CDN/frontend in API mode
}));

// 2. Response Compression (Gzip / Brotli)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses > 1KB
}));

// 3. Cookie Parser
app.use(cookieParser());

// 4. Database Connection
require("./config/db");

// 5. CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000"
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost:")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

// 6. Request Body Parsing with Strict Size Bounds (Anti-DoS)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// 7. General API Rate Limiter
const { generalApiLimiter } = require("./middleware/rateLimiter");
app.use("/api", generalApiLimiter);

// 8. Application Routes
app.use("/api/artist-profile", require("./routes/artistProfileRoutes"));
app.use("/api/albums", require("./routes/albumRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/artist", require("./routes/artistRoutes"));
app.use("/api/listener", require("./routes/listenerRoutes"));
app.use("/api/superadmin", require("./routes/superadminRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/catalog", require("./routes/catalogRoutes"));
app.use("/api/lyrics", require("./routes/lyricsRoutes"));
app.use("/api/songs", require("./routes/lyricsRoutes"));


// 9. Serve Uploaded Media Files Securely
const { ensureUploadsDir } = require("./services/mediaService");
ensureUploadsDir();
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "7d", // Browser cache static uploads for 7 days
  immutable: true
}));

// 10. Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// 11. 404 and Centralized Global Error Handler
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server Running on Port ${PORT}`);
  
  // Start Content Scheduler
  const schedulerService = require("./services/schedulerService");
  schedulerService.start(); // defaults to every 60 seconds
});

module.exports = app;
