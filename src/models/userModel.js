const { User, Role } = require("./index");
const { Op } = require("sequelize");

const UserModel = {
  // Find a user by email (used in register/login/forgot password)
  findByEmail: async (email) => {
    const user = await User.findOne({ where: { email } });
    return user ? user.get({ plain: true }) : null;
  },

  // Find a user by id
  findById: async (userId) => {
    const user = await User.findByPk(userId);
    return user ? user.get({ plain: true }) : null;
  },

  // Find all users with their roles
  findAll: async () => {
    const users = await User.findAll({
      include: [{ model: Role, attributes: ["role_name"] }],
    });
    return users.map((u) => {
      const plain = u.get({ plain: true });
      return {
        ...plain,
        role_name: plain.Role ? plain.Role.role_name : null,
      };
    });
  },

  // Get profile (joined with role name)
  findProfileById: async (userId) => {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, attributes: ["role_name"] }],
    });
    if (!user) return null;
    const plain = user.get({ plain: true });
    return {
      ...plain,
      role_name: plain.Role ? plain.Role.role_name : null,
    };
  },

  // Get user + role_name (used at login)
  findByEmailWithRole: async (email) => {
    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, attributes: ["role_name"] }],
    });
    if (!user) return null;
    const plain = user.get({ plain: true });
    return {
      ...plain,
      role_name: plain.Role ? plain.Role.role_name : null,
    };
  },

  create: async ({ username, email, hashPassword, role_id, phone }) => {
    const user = await User.create({
      username,
      email,
      password: hashPassword,
      role_id,
      phone,
    });
    return user.user_id;
  },

  updatePassword: async (userId, hashPassword) => {
    await User.update({ password: hashPassword }, { where: { user_id: userId } });
  },

  setResetToken: async (email, token, expiry) => {
    await User.update(
      { reset_token: token, reset_token_expiry: expiry },
      { where: { email } }
    );
  },

  findByValidResetToken: async (token) => {
    const user = await User.findOne({
      where: {
        reset_token: token,
        reset_token_expiry: { [Op.gt]: new Date() },
      },
    });
    return user ? user.get({ plain: true }) : null;
  },

  resetPasswordByToken: async (token, hashPassword) => {
    await User.update(
      { password: hashPassword, reset_token: null, reset_token_expiry: null },
      { where: { reset_token: token } }
    );
  },

  updateStatus: async (userId, status) => {
    await User.update({ status }, { where: { user_id: userId } });
  },

  updateRole: async (userId, roleId) => {
    await User.update({ role_id: roleId }, { where: { user_id: userId } });
  },

  updateProfile: async (userId, { username, address, avatar, phone }) => {
    await User.update({ username, address, avatar, phone }, { where: { user_id: userId } });
  },

  deleteById: async (userId) => {
    await User.destroy({ where: { user_id: userId } });
  },
};

module.exports = UserModel;
