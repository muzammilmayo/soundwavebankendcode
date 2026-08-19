/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("songs", (table) => {
    table.text("lyrics").nullable();
    table.string("lyrics_status", 50).notNullable().defaultTo("none");
    table.text("lyrics_error").nullable();
    table.string("lyrics_job_id", 255).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable("songs", (table) => {
    table.dropColumn("lyrics");
    table.dropColumn("lyrics_status");
    table.dropColumn("lyrics_error");
    table.dropColumn("lyrics_job_id");
  });
};
