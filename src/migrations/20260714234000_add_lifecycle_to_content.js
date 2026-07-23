/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Alter albums table
  await knex.schema.alterTable('albums', table => {
    table.string('status', 50).notNullable().defaultTo('draft');
    table.dateTime('scheduled_for').nullable();
  });

  // Alter songs table
  await knex.schema.alterTable('songs', table => {
    table.string('status', 50).notNullable().defaultTo('draft');
    table.dateTime('scheduled_for').nullable();
  });

  // Backfill statuses based on is_published
  await knex('albums').where('is_published', true).update({ status: 'published' });
  await knex('songs').where('is_published', true).update({ status: 'published' });

  // Drop is_published columns
  await knex.schema.alterTable('albums', table => {
    table.dropColumn('is_published');
  });

  await knex.schema.alterTable('songs', table => {
    table.dropColumn('is_published');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Re-add is_published columns
  await knex.schema.alterTable('albums', table => {
    table.boolean('is_published').defaultTo(false);
  });

  await knex.schema.alterTable('songs', table => {
    table.boolean('is_published').defaultTo(false);
  });

  // Backfill is_published based on status
  await knex('albums').where('status', 'published').update({ is_published: true });
  await knex('songs').where('status', 'published').update({ is_published: true });

  // Drop lifecycle columns
  await knex.schema.alterTable('albums', table => {
    table.dropColumn('status');
    table.dropColumn('scheduled_for');
  });

  await knex.schema.alterTable('songs', table => {
    table.dropColumn('status');
    table.dropColumn('scheduled_for');
  });
};
