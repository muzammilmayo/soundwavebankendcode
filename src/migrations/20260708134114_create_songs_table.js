exports.up = async function (knex) {
  await knex.schema.createTable("songs", (table) => {
    table.increments("song_id").primary();

    table
      .integer("artist_profile_id")
      .unsigned()
      .references("artist_profile_id")
      .inTable("artist_profiles")
      .onDelete("CASCADE");

    table
      .integer("album_id")
      .unsigned()
      .nullable()
      .references("album_id")
      .inTable("albums")
      .onDelete("SET NULL");

    table
      .integer("category_id")
      .unsigned()
      .references("category_id")
      .inTable("categories");

    table.string("title").notNullable();

    table.text("description");

    table.integer("duration");

    table.string("cover_image");

    table.string("audio_file").notNullable();

    table.date("release_date");

    table.boolean("is_published").defaultTo(false);

    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("songs");
};