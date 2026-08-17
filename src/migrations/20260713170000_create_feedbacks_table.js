/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable("feedbacks", (table) => {
    table.string("id", 50).primary(); // string ID to match frontend generator
    table.integer("song_id").unsigned().notNullable(); // INT UNSIGNED
    table.integer("user_id").notNullable(); // SIGNED to match users.user_id
    table.string("username", 100).notNullable();
    table.integer("rating").notNullable();
    table.text("comment").notNullable();
    table.timestamp("timestamp").defaultTo(knex.fn.now());
    table.boolean("edited").defaultTo(false);
    table.integer("likes").defaultTo(0);
    table.text("liked_by"); // JSON array string of user IDs who liked it

    // Foreign Keys
    table.foreign("song_id").references("song_id").inTable("songs").onDelete("CASCADE");
    table.foreign("user_id").references("user_id").inTable("users").onDelete("CASCADE");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("feedbacks");
};
