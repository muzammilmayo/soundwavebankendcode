exports.up = async function (knex) {
  // 1. Create roles table
  await knex.schema.createTable("roles", function (table) {
    table.increments("role_id").primary();
    table.string("role_name", 50).unique().notNullable();
  });

  // 2. Insert default roles
  await knex("roles").insert([
    { role_id: 1, role_name: "Super Admin" },
    { role_id: 2, role_name: "Admin" },
    { role_id: 3, role_name: "Artist" },
    { role_id: 4, role_name: "Moderator" },
    { role_id: 5, role_name: "Listener" },
  ]);

  // 3. Create users table
  await knex.schema.createTable("users", function (table) {
    table.increments("user_id").primary();
    table.string("username", 100).notNullable();
    table.string("email", 150).unique().notNullable();
    table.string("password", 255).notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.integer("role_id").unsigned().defaultTo(5);
    table.foreign("role_id").references("role_id").inTable("roles");
  });

  // 4. Create permissions table
  await knex.schema.createTable("permissions", function (table) {
    table.increments("permission_id").primary();
    table.string("permission_name", 100).unique().notNullable();
  });

  // 5. Insert default permissions
  await knex("permissions").insert([
    { permission_id: 1, permission_name: "manage_users" },
    { permission_id: 2, permission_name: "manage_songs" },
    { permission_id: 3, permission_name: "upload_song" },
    { permission_id: 4, permission_name: "edit_own_song" },
    { permission_id: 5, permission_name: "delete_song" },
    { permission_id: 6, permission_name: "moderate_content" },
    { permission_id: 7, permission_name: "play_song" },
    { permission_id: 8, permission_name: "create_playlist" },
    { permission_id: 9, permission_name: "manage_playlist" },
  ]);

  // 6. Create role_permissions table
  await knex.schema.createTable("role_permissions", function (table) {
    table.increments("id").primary();
    table.integer("role_id").unsigned().notNullable();
    table.integer("permission_id").unsigned().notNullable();
    table.foreign("role_id")
      .references("role_id")
      .inTable("roles")
      .onDelete("CASCADE");
    table.foreign("permission_id")
      .references("permission_id")
      .inTable("permissions")
      .onDelete("CASCADE");
    table.unique(["role_id", "permission_id"]);
  });

  // 7. Insert default role permissions
  // Super Admin (role_id = 1) gets all permissions 1-9
  const superAdminPerms = Array.from({ length: 9 }, (_, i) => ({
    role_id: 1,
    permission_id: i + 1,
  }));

  // Admin (role_id = 2) gets 1, 2, 5, 6
  const adminPerms = [
    { role_id: 2, permission_id: 1 },
    { role_id: 2, permission_id: 2 },
    { role_id: 2, permission_id: 5 },
    { role_id: 2, permission_id: 6 },
  ];

  // Artist (role_id = 3) gets 3, 4
  const artistPerms = [
    { role_id: 3, permission_id: 3 },
    { role_id: 3, permission_id: 4 },
  ];

  // Moderator (role_id = 4) gets 6
  const moderatorPerms = [{ role_id: 4, permission_id: 6 }];

  // Listener (role_id = 5) gets 7, 8, 9
  const listenerPerms = [
    { role_id: 5, permission_id: 7 },
    { role_id: 5, permission_id: 8 },
    { role_id: 5, permission_id: 9 },
  ];

  await knex("role_permissions").insert([
    ...superAdminPerms,
    ...adminPerms,
    ...artistPerms,
    ...moderatorPerms,
    ...listenerPerms,
  ]);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("role_permissions");
  await knex.schema.dropTableIfExists("permissions");
  await knex.schema.dropTableIfExists("users");
  await knex.schema.dropTableIfExists("roles");
};

exports.up = async function (knex) {
  await knex.schema.alterTable("users", function (table) {
    table.string("phone_number", 20).unique().nullable().after("email");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("users", function (table) {
    table.dropColumn("phone_number");
  });
};