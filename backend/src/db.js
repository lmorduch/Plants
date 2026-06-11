// ABOUTME: Postgres connection pool and schema initialization for the plant care app.
import pg from 'pg';

const { Pool } = pg;

const ssl = process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false;

// Prefer a single DATABASE_URL (Railway's managed Postgres exposes this); fall
// back to discrete PG* vars for local development.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, ssl })
  : new Pool({
      host: process.env.PGHOST,
      port: process.env.PGPORT || 5432,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      max: 10,
      ssl,
    });

// Convenience wrapper: returns rows array directly
export async function query(sql, params) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function columnExists(col, table) {
  const rows = await query(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, col]
  );
  return rows.length > 0;
}

async function ensureColumn(table, column, definition) {
  if (!(await columnExists(column, table))) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function indexExists(name) {
  const rows = await query(
    `SELECT 1 FROM pg_indexes WHERE indexname=$1`,
    [name]
  );
  return rows.length > 0;
}

async function ensureIndex(name, table, columns) {
  if (!(await indexExists(name))) {
    await pool.query(`CREATE INDEX ${name} ON ${table} (${columns})`);
  }
}

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_sub VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      picture VARCHAR(500),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS plants (
      id SERIAL PRIMARY KEY,
      user_id INT,
      name VARCHAR(255) NOT NULL,
      species VARCHAR(255),
      location VARCHAR(255),
      acquired_date DATE,
      notes TEXT,
      photo_url VARCHAR(500),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS care_logs (
      id SERIAL PRIMARY KEY,
      plant_id INT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      notes TEXT,
      photo_url VARCHAR(500),
      logged_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS care_schedules (
      id SERIAL PRIMARY KEY,
      plant_id INT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      interval_days INT NOT NULL,
      last_done DATE,
      next_due DATE,
      notify_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      notify_days_before INT NOT NULL DEFAULT 0,
      UNIQUE (plant_id, type)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INT,
      endpoint VARCHAR(767) NOT NULL UNIQUE,
      p256dh VARCHAR(500) NOT NULL,
      auth VARCHAR(500) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Idempotent column additions
  await ensureColumn('plants', 'user_id', 'INT');
  await ensureIndex('idx_plants_user', 'plants', 'user_id');
  await ensureColumn('push_subscriptions', 'user_id', 'INT');
  await ensureIndex('idx_push_user', 'push_subscriptions', 'user_id');

  await ensureColumn('users', 'anthropic_key', 'VARCHAR(512)');
  await ensureColumn('users', 'anthropic_key_hint', 'VARCHAR(32)');

  await ensureColumn('plants', 'pet_safe', 'VARCHAR(16)');
  await ensureColumn('plants', 'pet_safety_notes', 'VARCHAR(500)');
  await ensureColumn('plants', 'sun_preference', 'VARCHAR(255)');
  await ensureColumn('plants', 'fun_facts', 'JSONB');
  await ensureColumn('plants', 'history_and_origin', 'TEXT');
  await ensureColumn('plants', 'extra_notes', 'TEXT');
  await ensureColumn('plants', 'life_cycle', 'VARCHAR(64)');

  await ensureColumn('care_schedules', 'notes', 'TEXT');
  await ensureColumn('care_schedules', 'spring_days', 'INT');
  await ensureColumn('care_schedules', 'summer_days', 'INT');
  await ensureColumn('care_schedules', 'fall_days', 'INT');
  await ensureColumn('care_schedules', 'winter_days', 'INT');
}

export default pool;
