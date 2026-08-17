/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "phone");
  if (!hasColumn) {
    await knex.schema.table("users", function (table) {
      table.string("phone", 20).nullable();
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "phone");
  if (hasColumn) {
    await knex.schema.table("users", function (table) {
      table.dropColumn("phone");
    });
  }
};
