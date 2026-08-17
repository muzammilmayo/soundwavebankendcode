exports.up = async function (knex) {
  await knex.schema.createTable("artist_moderators", function (table) {
    table.increments("id").primary();
    table.integer("artist_id").unsigned().notNullable();
    table.integer("user_id").notNullable();
    table.string("status", 50).defaultTo("active").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    table.foreign("artist_id")
      .references("artist_profile_id")
      .inTable("artist_profiles")
      .onDelete("CASCADE");

    table.foreign("user_id")
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    table.unique(["artist_id", "user_id"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("artist_moderators");
};
