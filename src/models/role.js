const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Role = sequelize.define(
  "Role",
  {
    role_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role_name: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
  },
  {
    tableName: "roles",
    timestamps: false,
  }
);

module.exports = Role;
