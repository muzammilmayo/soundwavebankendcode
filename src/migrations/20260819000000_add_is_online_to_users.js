exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "is_online");
  if (!hasColumn) {
    await knex.schema.table("users", function (table) {
      table.boolean("is_online").defaultTo(false);
    });
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "is_online");
  if (hasColumn) {
    await knex.schema.table("users", function (table) {
      table.dropColumn("is_online");
    });
  }
};
