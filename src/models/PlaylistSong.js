const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const PlaylistSong = sequelize.define(
  "PlaylistSong",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    playlist_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    song_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "playlist_songs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = PlaylistSong;
