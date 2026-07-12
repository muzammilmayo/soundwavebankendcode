const db = require("../models");
const Album = db.Album;

exports.createAlbum = async (req, res) => {
  try {
    const album = await Album.create(req.body);

    res.status(201).json({
      success: true,
      message: "Album created successfully",
      data: album
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.getAllAlbums = async (req, res) => {
  const albums = await Album.findAll();

  res.json({
    success: true,
    data: albums
  });
};