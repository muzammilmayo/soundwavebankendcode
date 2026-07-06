const PermissionModel = require("../models/permissionModel");

const PermissionService = {
  checkPermission: async (roleId, permissionName) => {
    return PermissionModel.hasPermission(roleId, permissionName);
  },
};

module.exports = PermissionService;
