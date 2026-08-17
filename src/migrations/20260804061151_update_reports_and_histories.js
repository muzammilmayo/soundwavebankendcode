/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Drop legacy reports table
  await knex.schema.dropTableIfExists("reports");

  // Create new reports table
  await knex.schema.createTable("reports", (table) => {
    table.increments("id").primary();
    table.integer("reporter_id").notNullable(); // Signed integer to match users.user_id
    table.string("report_type", 50).notNullable(); // song, album, artist, comment, user, bug
    table.string("target_id", 255).nullable(); // ID of reported resource, null for bug reports
    table.integer("assigned_to").nullable(); // Signed integer referencing users.user_id
    table.string("assigned_role", 100).nullable(); // Artist Moderator, Platform Moderator, Admin
    table.string("reason", 255).notNullable();
    table.text("description").nullable();
    table.string("status", 50).notNullable().defaultTo("Pending"); // Pending, Under Review, Resolved, Rejected, Closed
    table.text("resolution").nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    // Foreign Keys
    table.foreign("reporter_id").references("user_id").inTable("users").onDelete("CASCADE");
    table.foreign("assigned_to").references("user_id").inTable("users").onDelete("SET NULL");
  });

  // Create report_histories table
  await knex.schema.createTable("report_histories", (table) => {
    table.increments("id").primary();
    table.integer("report_id").unsigned().notNullable(); // unsigned to match reports.id primary key increments
    table.integer("user_id").notNullable(); // Actor who did action (signed to match users.user_id)
    table.string("action", 255).notNullable(); // e.g. Status Updated, Song Removed, Note Added
    table.text("notes").nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());

    // Foreign Keys
    table.foreign("report_id").references("id").inTable("reports").onDelete("CASCADE");
    table.foreign("user_id").references("user_id").inTable("users").onDelete("CASCADE");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("report_histories");
  await knex.schema.dropTableIfExists("reports");
};
