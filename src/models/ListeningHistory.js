const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ListeningHistory = sequelize.define(
  "ListeningHistory",
  {
    history_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    song_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    played_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "listening_history",
    timestamps: false,
  }
);

module.exports = ListeningHistory;
