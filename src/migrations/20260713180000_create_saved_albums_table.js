/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable("saved_albums", (table) => {
    table.increments("saved_album_id").primary();
    table.integer("user_id").notNullable(); // SIGNED to match users.user_id
    table.integer("album_id").unsigned().notNullable(); // UNSIGNED to match albums.album_id
    table.timestamps(true, true);

    // Foreign Keys
    table.foreign("user_id").references("user_id").inTable("users").onDelete("CASCADE");
    table.foreign("album_id").references("album_id").inTable("albums").onDelete("CASCADE");

    // Unique Constraint to prevent duplicate saves
    table.unique(["user_id", "album_id"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("saved_albums");
};
