exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "last_seen_at");
  if (!hasColumn) {
    await knex.schema.table("users", function (table) {
      table.datetime("last_seen_at").nullable();
    });
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "last_seen_at");
  if (hasColumn) {
    await knex.schema.table("users", function (table) {
      table.dropColumn("last_seen_at");
    });
  }
};
