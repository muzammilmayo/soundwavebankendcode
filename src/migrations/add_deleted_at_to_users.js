'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add a nullable timestamp column to mark soft deletions
    await queryInterface.addColumn('users', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'deleted_at');
  },
};
