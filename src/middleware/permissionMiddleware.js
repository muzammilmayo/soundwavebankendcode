const { User, Role } = require('../models');

/**
 * Middleware factory to check if the user's role has a required permission.
 * Usage: `checkPermission('upload_song')`
 */
function checkPermission(requiredPermission) {
  return (req, res, next) => {
    const user = req.user; // set by authMiddleware (decoded JWT payload containing id, role_id)
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Always query database to get the latest role assignment
    const roleIdPromise = User.findByPk(user.id).then(u => u?.role_id);

    roleIdPromise
      .then(roleId => {
        if (!roleId) {
          return res.status(403).json({ success: false, message: 'Forbidden: role not found' });
        }
        
        return Role.findByPk(roleId).then(role => {
          if (!role) {
            return res.status(403).json({ success: false, message: 'Forbidden: role not found' });
          }
          
          // Admin or Super Admin bypass
          if (role.role_name === 'Admin' || role.role_name === 'Super Admin') {
            return next();
          }

          return role.getPermissions().then(perms => {
            const has = perms.some(p => p.permission_name === requiredPermission);
            if (!has) {
              return res.status(403).json({ success: false, message: 'Forbidden: missing permission' });
            }
            next();
          });
        });
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
      });
  };
}

module.exports = checkPermission;
