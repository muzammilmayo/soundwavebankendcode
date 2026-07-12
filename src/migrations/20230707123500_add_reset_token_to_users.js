exports.up = async function (knex) {
  const hasResetToken = await knex.schema.hasColumn('users', 'reset_token');
  const hasExpiry = await knex.schema.hasColumn('users', 'reset_token_expiry');
  if (!hasResetToken) {
    await knex.schema.table('users', t => {
      t.string('reset_token', 64).nullable();
    });
  }
  if (!hasExpiry) {
    await knex.schema.table('users', t => {
      t.datetime('reset_token_expiry').nullable();
    });
  }
};

exports.down = async function (knex) {
  const hasResetToken = await knex.schema.hasColumn('users', 'reset_token');
  const hasExpiry = await knex.schema.hasColumn('users', 'reset_token_expiry');
  if (hasResetToken) {
    await knex.schema.table('users', t => {
      t.dropColumn('reset_token');
    });
  }
  if (hasExpiry) {
    await knex.schema.table('users', t => {
      t.dropColumn('reset_token_expiry');
    });
  }
};
