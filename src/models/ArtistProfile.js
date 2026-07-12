module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "ArtistProfile",
    {
      artist_profile_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: DataTypes.INTEGER,
      stage_name: DataTypes.STRING,
      bio: DataTypes.TEXT,
      profile_image: DataTypes.STRING,
      cover_image: DataTypes.STRING,
      facebook: DataTypes.STRING,
      instagram: DataTypes.STRING,
      youtube: DataTypes.STRING,
      spotify: DataTypes.STRING,
      is_verified: DataTypes.BOOLEAN,
    },
    {
      tableName: "artist_profiles",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
};