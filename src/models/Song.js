module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "Song",
    {
      song_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      artist_profile_id: DataTypes.INTEGER,
      album_id: DataTypes.INTEGER,
      category_id: DataTypes.INTEGER,
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      duration: DataTypes.INTEGER,
      cover_image: DataTypes.STRING,
      audio_file: DataTypes.STRING,
      release_date: DataTypes.DATEONLY,
      is_published: DataTypes.BOOLEAN,
      play_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
    },
    {
      tableName: "songs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
};