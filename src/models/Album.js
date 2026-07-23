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
      status: {
        type: DataTypes.STRING(50),
        defaultValue: 'draft',
        allowNull: false,
      },
      scheduled_for: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_published: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('status') === 'published';
        }
      },
    },
    {
      tableName: "albums",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
};