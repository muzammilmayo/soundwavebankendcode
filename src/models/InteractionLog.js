const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const InteractionLog = sequelize.define(
  "InteractionLog",
  {
    log_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    interaction_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    target_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    target_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "interaction_logs",
    timestamps: false,
  }
);

module.exports = InteractionLog;
