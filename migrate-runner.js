#!/usr/bin/env node
/**
 * migrate-runner.js — runs Prisma migrations without the Prisma CLI.
 * Reads migration SQL files and executes them via pg, tracking which
 * migrations have already been applied in the _prisma_migrations table.
 */
const path = require('path');
const fs   = require('fs');
const { Client } = require('pg');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database.');

  // Ensure the migrations tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id                      VARCHAR(36)  NOT NULL PRIMARY KEY,
      checksum                VARCHAR(64)  NOT NULL,
      finished_at             TIMESTAMPTZ,
      migration_name          TEXT         NOT NULL,
      logs                    TEXT,
      rolled_back_at          TIMESTAMPTZ,
      started_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      applied_steps_count     INTEGER      NOT NULL DEFAULT 0
    );
  `);

  // Find migration directories
  const migrationsDir = path.join(__dirname, 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found at', migrationsDir);
    await client.end();
    return;
  }

  const dirs = fs.readdirSync(migrationsDir)
    .filter(d => fs.statSync(path.join(migrationsDir, d)).isDirectory())
    .sort();

  // Get already-applied migrations
  const { rows: applied } = await client.query(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'
  );
  const appliedSet = new Set(applied.map(r => r.migration_name));

  let ran = 0;
  for (const dir of dirs) {
    if (appliedSet.has(dir)) {
      console.log('  already applied:', dir);
      continue;
    }
    const sqlFile = path.join(migrationsDir, dir, 'migration.sql');
    if (!fs.existsSync(sqlFile)) continue;

    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log('  applying:', dir);
    const id = require('crypto').randomUUID();
    const checksum = require('crypto').createHash('sha256').update(sql).digest('hex').slice(0, 64);

    await client.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count)
       VALUES ($1, $2, $3, NOW(), 0)`,
      [id, checksum, dir]
    );

    try {
      await client.query(sql);
      await client.query(
        `UPDATE "_prisma_migrations" SET finished_at = NOW(), applied_steps_count = 1 WHERE id = $1`,
        [id]
      );
      console.log('  ✓ applied:', dir);
      ran++;
    } catch (err) {
      await client.query(
        `UPDATE "_prisma_migrations" SET logs = $1, rolled_back_at = NOW() WHERE id = $2`,
        [err.message, id]
      );
      console.error('  ✗ failed:', dir, err.message);
      await client.end();
      process.exit(1);
    }
  }

  console.log(`Migrations complete. ${ran} new migration(s) applied.`);

  // Grant the app's runtime user access to all tables and sequences.
  // This is needed when the migration runs as a different DB user than the app.
  const appUser = process.env.DB_APP_USER;
  if (appUser) {
    console.log(`Granting privileges to app user: ${appUser}`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${appUser}"`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${appUser}"`);
    console.log('Grants applied.');
  } else {
    // Derive the username from DATABASE_URL
    const url = new URL(process.env.DATABASE_URL);
    const user = url.username;
    console.log(`Granting privileges to database user: ${user}`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${user}"`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${user}"`);
    console.log('Grants applied.');
  }

  await client.end();
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
