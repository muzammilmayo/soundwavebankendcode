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

    table.string("stage_name", 100).notNullable();
    table.text("bio");
    table.string("profile_image");
    table.string("cover_image");
    table.string("facebook");
    table.string("instagram");
    table.string("youtube");
    table.string("spotify");
    table.boolean("is_verified").defaultTo(false);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("artist_profiles");
};