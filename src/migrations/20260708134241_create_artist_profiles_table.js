exports.up = async function (knex) {
  await knex.schema.createTable("artist_profiles", function (table) {
    table.increments("artist_profile_id").primary();

    table
      .integer("user_id")
      .unsigned()
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    table.string("stage_name", 255).notNullable();

    table.text("bio");

    table.string("profile_image", 255);

    table.string("cover_image", 255);

    table.string("facebook", 255);

    table.string("instagram", 255);

    table.string("youtube", 255);

    table.string("spotify", 255);

    table.boolean("is_verified").defaultTo(false);

    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("artist_profiles");
};