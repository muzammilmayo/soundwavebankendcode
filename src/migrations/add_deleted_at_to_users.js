/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "deleted_at");
  if (!hasColumn) {
    await knex.schema.table("users", function (table) {
      table.timestamp("deleted_at").nullable();
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "deleted_at");
  if (hasColumn) {
    await knex.schema.table("users", function (table) {
      table.dropColumn("deleted_at");
    });
  }
};
