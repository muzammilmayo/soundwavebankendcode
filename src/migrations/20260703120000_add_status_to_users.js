exports.up = function (knex) {
  return knex.schema.table("users", function (table) {
    table.string("status", 20).defaultTo("Active");
  });
};

exports.down = function (knex) {
  return knex.schema.table("users", function (table) {
    table.dropColumn("status");
  });
};
