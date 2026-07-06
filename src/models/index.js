const sequelize = require("../config/db");
const User = require("./user");
const Role = require("./role");
const Permission = require("./permission");
const RolePermission = require("./rolePermission");

// Associations
User.belongsTo(Role, { foreignKey: "role_id" });
Role.hasMany(User, { foreignKey: "role_id" });

Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "role_id",
  otherKey: "permission_id",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permission_id",
  otherKey: "role_id",
});

module.exports = {
  sequelize,
  User,
  Role,
  Permission,
  RolePermission,
};
