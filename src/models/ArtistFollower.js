const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ArtistFollower = sequelize.define(
  "ArtistFollower",
  {
    follower_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    artist_profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "artist_followers",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = ArtistFollower;
