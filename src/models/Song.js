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
      play_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      tags: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      // ── Lyrics Generation ──────────────────────────────────────────
      lyrics: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      lyrics_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'none',
        // Allowed values: 'none' | 'pending' | 'processing' | 'completed' | 'failed'
      },
      lyrics_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      lyrics_job_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "songs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      paranoid: true,
      deletedAt: "deleted_at",
    }
  );
};