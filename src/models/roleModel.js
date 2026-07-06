const { Role } = require("./index");

const RoleModel = {
  findAll: async () => {
    const roles = await Role.findAll();
    return roles.map((r) => r.get({ plain: true }));
  },

  findById: async (roleId) => {
    const role = await Role.findByPk(roleId);
    return role ? role.get({ plain: true }) : null;
  },
};

module.exports = RoleModel;
