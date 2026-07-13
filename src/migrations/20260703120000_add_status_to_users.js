exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "status");
  if (!hasColumn) {
    await knex.schema.table("users", function (table) {
      table.string("status", 20).defaultTo("Active");
    });
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "status");
  if (hasColumn) {
    await knex.schema.table("users", function (table) {
      table.dropColumn("status");
    });
  }
};
