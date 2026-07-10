exports.up = async function (knex) {
  await knex.schema.createTable("albums", (table) => {
    table.increments("album_id").primary();

    table
      .integer("artist_profile_id")
      .unsigned()
      .references("artist_profile_id")
      .inTable("artist_profiles")
      .onDelete("CASCADE");

    table.string("title").notNullable();

    table.text("description");
    table.string("cover_image");

    table.date("release_date");

    table.boolean("is_published").defaultTo(false);

    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("albums");
};