const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Permission = sequelize.define(
  "Permission",
  {
    permission_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    permission_name: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
    },
  },
  {
    tableName: "permissions",
    timestamps: false,
  }
);

module.exports = Permission;
