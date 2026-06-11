// ABOUTME: One-off migration of plant data from the legacy MySQL database into Postgres.
// ABOUTME: Run inside the Railway backend container where both DB hosts resolve.
import mysql from 'mysql2/promise';
import pg from 'pg';

const my = await mysql.createConnection({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT || 3306,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
});

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function myRows(sql) {
  const [rows] = await my.query(sql);
  return rows;
}

async function copy(table, columns, mapRow) {
  const rows = await myRows(`SELECT * FROM ${table}`);
  let inserted = 0;
  for (const r of rows) {
    const values = mapRow(r);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
    const { rowCount } = await pgPool.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
      values
    );
    inserted += rowCount;
  }
  // Keep the SERIAL sequence ahead of the highest migrated id.
  await pgPool.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'),
       GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1))`
  );
  console.log(`${table}: ${rows.length} read, ${inserted} inserted`);
}

try {
  // Note: anthropic_key/hint are intentionally skipped — the app moved to Gemini,
  // so stored Anthropic keys are stale and users re-enter a Gemini key.
  await copy('users', ['id', 'google_sub', 'email', 'name', 'picture', 'created_at'],
    u => [u.id, u.google_sub, u.email, u.name, u.picture, u.created_at]);

  await copy('plants',
    ['id', 'user_id', 'name', 'species', 'location', 'acquired_date', 'notes', 'photo_url', 'created_at', 'updated_at'],
    p => [p.id, p.user_id, p.name, p.species, p.location, p.acquired_date, p.notes, p.photo_url, p.created_at, p.updated_at]);

  await copy('care_logs',
    ['id', 'plant_id', 'type', 'notes', 'photo_url', 'logged_at'],
    l => [l.id, l.plant_id, l.type, l.notes, l.photo_url, l.logged_at]);

  await copy('care_schedules',
    ['id', 'plant_id', 'type', 'interval_days', 'last_done', 'next_due', 'notify_enabled', 'notify_days_before'],
    s => [s.id, s.plant_id, s.type, s.interval_days, s.last_done, s.next_due, !!s.notify_enabled, s.notify_days_before]);

  await copy('push_subscriptions',
    ['id', 'user_id', 'endpoint', 'p256dh', 'auth', 'created_at'],
    s => [s.id, s.user_id, s.endpoint, s.p256dh, s.auth, s.created_at]);

  console.log('Migration complete.');
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await my.end();
  await pgPool.end();
}
