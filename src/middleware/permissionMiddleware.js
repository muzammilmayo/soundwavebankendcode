const { User, Role } = require('../models');

/**
 * Middleware factory to check if the user's role has a required permission.
 * Usage: `checkPermission('upload_song')`
 */
function checkPermission(requiredPermission) {
  return async (req, res, next) => {
    const user = req.user; // set by authMiddleware (decoded JWT payload containing id, role_id)
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      // 1. Check if user is an active artist moderator for content operations
      const allowedModeratorPermissions = ['upload_song', 'edit_own_song', 'delete_song', 'moderate_content'];
      if (allowedModeratorPermissions.includes(requiredPermission)) {
        const { ArtistModerator } = require('../models');
        const moderator = await ArtistModerator.findOne({
          where: { user_id: user.id, status: 'active' }
        });
        if (moderator) {
          return next();
        }
      }

      // 2. Query database to get the latest role assignment
      const userRecord = await User.findByPk(user.id);
      if (!userRecord || !userRecord.role_id) {
        return res.status(403).json({ success: false, message: 'Forbidden: role not found' });
      }

      const role = await Role.findByPk(userRecord.role_id);
      if (!role) {
        return res.status(403).json({ success: false, message: 'Forbidden: role not found' });
      }

      // Admin or Super Admin bypass
      if (role.role_name === 'Admin' || role.role_name === 'Super Admin') {
        return next();
      }

      const perms = await role.getPermissions();
      const has = perms.some(p => p.permission_name === requiredPermission);
      if (!has) {
        return res.status(403).json({ success: false, message: 'Forbidden: missing permission' });
      }
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
}

module.exports = checkPermission;
