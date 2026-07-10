/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable("categories", (table) => {
    table.increments("category_id").primary();
    table.string("name", 100).unique().notNullable();
    table.text("description");
    table.timestamps(true, true);
  });

  // Seed default categories
  await knex("categories").insert([
    { name: "Pop", description: "Popular music genre with catchy melodies." },
    { name: "Rock", description: "Rock 'n' roll, classic rock, and alternative rock." },
    { name: "Hip-Hop", description: "Hip-hop, rap, and trap music." },
    { name: "R&B", description: "Rhythm and blues, soul, and contemporary R&B." },
    { name: "Jazz", description: "Classic jazz, smooth jazz, and fusion." },
    { name: "Electronic", description: "EDM, house, techno, and ambient electronic." },
    { name: "Classical", description: "Orchestral, piano, and traditional classical works." },
    { name: "Reggae", description: "Reggae, dancehall, and ska." }
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("categories");
};
