/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Create song_likes table
  await knex.schema.createTable("song_likes", (table) => {
    table.increments("like_id").primary();
    table.integer("user_id").notNullable(); // SIGNED to match users.user_id (int(11))
    table.integer("song_id").unsigned().notNullable(); // UNSIGNED to match songs.song_id (int(10) unsigned)
    table.timestamps(true, true);

    // Foreign Keys
    table.foreign("user_id").references("user_id").inTable("users").onDelete("CASCADE");
    table.foreign("song_id").references("song_id").inTable("songs").onDelete("CASCADE");

    // Unique Constraint to prevent duplicate likes
    table.unique(["user_id", "song_id"]);
  });

  // Create artist_followers table
  await knex.schema.createTable("artist_followers", (table) => {
    table.increments("follower_id").primary();
    table.integer("user_id").notNullable(); // SIGNED to match users.user_id (int(11))
    table.integer("artist_profile_id").unsigned().notNullable(); // UNSIGNED to match artist_profiles.artist_profile_id (int(10) unsigned)
    table.timestamps(true, true);

    // Foreign Keys
    table.foreign("user_id").references("user_id").inTable("users").onDelete("CASCADE");
    table.foreign("artist_profile_id").references("artist_profile_id").inTable("artist_profiles").onDelete("CASCADE");

    // Unique Constraint to prevent duplicate follows
    table.unique(["user_id", "artist_profile_id"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("artist_followers");
  await knex.schema.dropTableIfExists("song_likes");
};
