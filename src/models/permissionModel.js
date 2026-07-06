const { Permission, Role } = require("./index");

const PermissionModel = {
  // Checks whether a given role has a given permission
  hasPermission: async (roleId, permissionName) => {
    const perm = await Permission.findOne({
      where: { permission_name: permissionName },
      include: [
        {
          model: Role,
          where: { role_id: roleId },
          through: { attributes: [] },
        },
      ],
    });
    return !!perm;
  },
};

module.exports = PermissionModel;
