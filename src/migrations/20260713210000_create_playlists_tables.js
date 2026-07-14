/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Create playlists table
  await knex.schema.createTable("playlists", (table) => {
    table.string("id", 50).primary(); // matching frontend string IDs
    table.string("name", 255).notNullable();
    table.integer("user_id").notNullable(); // SIGNED to match users.user_id
    table.timestamps(true, true);

    // Foreign Key
    table.foreign("user_id").references("user_id").inTable("users").onDelete("CASCADE");
  });

  // Create playlist_songs join table
  await knex.schema.createTable("playlist_songs", (table) => {
    table.increments("id").primary();
    table.string("playlist_id", 50).notNullable();
    table.integer("song_id").unsigned().notNullable(); // UNSIGNED to match songs.song_id
    table.integer("order").defaultTo(0);
    table.timestamps(true, true);

    // Foreign Keys
    table.foreign("playlist_id").references("id").inTable("playlists").onDelete("CASCADE");
    table.foreign("song_id").references("song_id").inTable("songs").onDelete("CASCADE");

    // Unique combination of playlist and song order
    table.unique(["playlist_id", "song_id", "order"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("playlist_songs");
  await knex.schema.dropTableIfExists("playlists");
};
