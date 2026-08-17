const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const albumController = require("../controllers/albumController");

router.post("/", verifyToken, albumController.createAlbum);
router.get("/", verifyToken, albumController.getAllAlbums);

module.exports = router;