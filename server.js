const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();

require("./src/config/db");

app.use(cors());
app.use(express.json());
app.use("/api/admin", require("./src/routes/adminRoutes"));
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/artist", require("./src/routes/artistRoutes"));
app.use("/api/moderator", require("./src/routes/moderatorRoutes"));
app.use("/api/listener", require("./src/routes/listenerRoutes"));
app.use("/api/superadmin", require("./src/routes/superadminRoutes"));
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server Running on Port ${PORT}`);
});