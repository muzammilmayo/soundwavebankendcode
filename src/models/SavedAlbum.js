const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const SavedAlbum = sequelize.define(
  "SavedAlbum",
  {
    saved_album_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    album_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "saved_albums",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = SavedAlbum;
