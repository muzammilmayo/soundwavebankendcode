const PermissionService = require("../services/permissionService");

const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const roleId = req.user.role_id;

      const allowed = await PermissionService.checkPermission(roleId, permission);

      if (!allowed) {
        return res.status(403).json({
          message: "Permission Denied",
        });
      }

      next();
    } catch (err) {
      return res.status(500).json(err);
    }
  };
};

module.exports = checkPermission;
