module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "Album",
    {
      album_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      artist_profile_id: DataTypes.INTEGER,
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      cover_image: DataTypes.STRING,
      release_date: DataTypes.DATEONLY,
      is_published: DataTypes.BOOLEAN,
    },
    {
      tableName: "albums",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
};