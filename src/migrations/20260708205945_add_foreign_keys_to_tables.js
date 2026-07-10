/**
 * Fix type mismatches and add all foreign key constraints.
 * - albums.artist_profile_id must be int UNSIGNED to match artist_profiles.artist_profile_id (int unsigned)
 * - artist_profiles.user_id is already int(11) signed matching users.user_id
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Clear data first to avoid constraint issues during column type change
  await knex("songs").del();
  await knex("albums").del();
  await knex("artist_profiles").del();

  // 1. Fix albums.artist_profile_id: change int(11) signed → int UNSIGNED to match artist_profiles PK
  await knex.raw(`
    ALTER TABLE albums 
    MODIFY COLUMN artist_profile_id INT UNSIGNED NULL
  `);

  // 2. artist_profiles_user_id_foreign already exists — skip to avoid errno 121 (duplicate key)

  // 3. Add FK: albums.artist_profile_id → artist_profiles.artist_profile_id (both now int UNSIGNED)
  await knex.raw(`
    ALTER TABLE albums 
    ADD CONSTRAINT albums_artist_profile_id_foreign 
    FOREIGN KEY (artist_profile_id) REFERENCES artist_profiles(artist_profile_id) ON DELETE CASCADE
  `);

  // 4. Add FK: songs.artist_profile_id → artist_profiles.artist_profile_id (both int UNSIGNED)
  await knex.raw(`
    ALTER TABLE songs 
    ADD CONSTRAINT songs_artist_profile_id_foreign 
    FOREIGN KEY (artist_profile_id) REFERENCES artist_profiles(artist_profile_id) ON DELETE CASCADE
  `);

  // 5. Add FK: songs.album_id → albums.album_id (both int UNSIGNED)
  await knex.raw(`
    ALTER TABLE songs 
    ADD CONSTRAINT songs_album_id_foreign 
    FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE SET NULL
  `);

  // 6. Add FK: songs.category_id → categories.category_id (both int UNSIGNED)
  await knex.raw(`
    ALTER TABLE songs 
    ADD CONSTRAINT songs_category_id_foreign 
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.raw(`ALTER TABLE songs DROP FOREIGN KEY songs_category_id_foreign`);
  await knex.raw(`ALTER TABLE songs DROP FOREIGN KEY songs_album_id_foreign`);
  await knex.raw(`ALTER TABLE songs DROP FOREIGN KEY songs_artist_profile_id_foreign`);
  await knex.raw(`ALTER TABLE albums DROP FOREIGN KEY albums_artist_profile_id_foreign`);
  await knex.raw(`ALTER TABLE artist_profiles DROP FOREIGN KEY artist_profiles_user_id_foreign`);

  // Restore albums.artist_profile_id to original signed int
  await knex.raw(`ALTER TABLE albums MODIFY COLUMN artist_profile_id INT NULL`);
};
