const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
const cookieParser = require('cookie-parser');
app.use(cookieParser());
require("./config/db");
const allowedOrigins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"];
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
app.use(express.json());
app.use(
  "/api/artist-profile",
  require("./routes/artistProfileRoutes")
);
app.use("/api/albums", require("./routes/albumRoutes"));

app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/artist", require("./routes/artistRoutes"));
app.use("/api/moderator", require("./routes/moderatorRoutes"));
app.use("/api/listener", require("./routes/listenerRoutes"));
app.use("/api/superadmin", require("./routes/superadminRoutes"));

// Serve uploaded media files
const path = require('path');
const { ensureUploadsDir } = require('./services/mediaService');
ensureUploadsDir();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Catalog routes (public & admin)
app.use('/api/catalog', require('./routes/catalogRoutes'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server Running on Port ${PORT}`);
});
