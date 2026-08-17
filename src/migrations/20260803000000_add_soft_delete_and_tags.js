/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Alter songs table to add soft delete and tags
  await knex.schema.alterTable('songs', (table) => {
    table.dateTime('deleted_at').nullable();
    table.string('tags', 255).nullable();
  });

  // Alter albums table to add soft delete
  await knex.schema.alterTable('albums', (table) => {
    table.dateTime('deleted_at').nullable();
  });

  // Alter playlists table to add soft delete
  await knex.schema.alterTable('playlists', (table) => {
    table.dateTime('deleted_at').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.dropColumn('deleted_at');
  });

  await knex.schema.alterTable('albums', (table) => {
    table.dropColumn('deleted_at');
  });

  await knex.schema.alterTable('songs', (table) => {
    table.dropColumn('deleted_at');
    table.dropColumn('tags');
  });
};
