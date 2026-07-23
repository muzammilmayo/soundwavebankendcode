/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable("listening_history", (table) => {
    table.increments("history_id").primary();
    table.integer("user_id").notNullable(); // SIGNED to match users.user_id
    table.integer("song_id").unsigned().notNullable(); // UNSIGNED to match songs.song_id
    table.timestamp("played_at").defaultTo(knex.fn.now());

    // Foreign Keys
    table.foreign("user_id").references("user_id").inTable("users").onDelete("CASCADE");
    table.foreign("song_id").references("song_id").inTable("songs").onDelete("CASCADE");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("listening_history");
};
