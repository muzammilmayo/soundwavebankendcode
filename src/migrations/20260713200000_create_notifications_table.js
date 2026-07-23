/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable("notifications", (table) => {
    table.string("id", 50).primary(); // matching frontend notification string IDs
    table.integer("user_id").notNullable(); // SIGNED to match users.user_id
    table.string("type", 50);
    table.integer("target_id").unsigned();
    table.string("title", 255);
    table.text("message");
    table.timestamp("timestamp").defaultTo(knex.fn.now());
    table.boolean("read").defaultTo(false);
    table.boolean("cleared").defaultTo(false);

    // Foreign Key
    table.foreign("user_id").references("user_id").inTable("users").onDelete("CASCADE");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("notifications");
};
