module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "ArtistModerator",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      artist_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(50),
        defaultValue: "active",
        allowNull: false,
      },
    },
    {
      tableName: "artist_moderators",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
};
