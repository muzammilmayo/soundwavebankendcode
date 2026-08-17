/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Create interaction_logs table
  await knex.schema.createTable("interaction_logs", (table) => {
    table.increments("log_id").primary();
    table.integer("user_id").nullable(); // NULLABLE to support guest or unauth searches/actions
    table.string("interaction_type", 50).notNullable(); // e.g. 'play', 'like', 'unlike', 'follow', 'search', etc.
    table.string("target_type", 50).nullable(); // e.g. 'song', 'album', 'artist', 'playlist', 'none'
    table.string("target_id", 255).nullable();
    table.text("details").nullable(); // e.g. search query term
    table.timestamp("timestamp").defaultTo(knex.fn.now());

    // Foreign Keys
    table.foreign("user_id").references("user_id").inTable("users").onDelete("CASCADE");
  });

  // 2. Create reports table
  await knex.schema.createTable("reports", (table) => {
    table.increments("report_id").primary();
    table.integer("user_id").notNullable(); // Reporter user ID
    table.string("target_type", 50).notNullable(); // 'song', 'album', 'playlist', 'user'
    table.string("target_id", 255).notNullable(); // ID of reported item
    table.string("reason", 255).notNullable();
    table.string("status", 50).notNullable().defaultTo("pending"); // 'pending', 'resolved', 'dismissed'
    table.timestamp("created_at").defaultTo(knex.fn.now());

    // Foreign Keys
    table.foreign("user_id").references("user_id").inTable("users").onDelete("CASCADE");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("reports");
  await knex.schema.dropTableIfExists("interaction_logs");
};
