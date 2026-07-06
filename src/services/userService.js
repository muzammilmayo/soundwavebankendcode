const UserModel = require("../models/userModel");

const UserService = {
  getProfile: async (userId) => {
    const user = await UserModel.findProfileById(userId);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    return user;
  },
};

module.exports = UserService;
