// ABOUTME: MySQL connection pool and schema initialization for the plant care app.
// ABOUTME: Creates tables and idempotently migrates ownership columns onto existing ones.
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT || 3306,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 10,
});

// Table and column names below are hardcoded (never user input), so interpolation is safe.
async function columnExists(conn, table, column) {
  const [[row]] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return row.c > 0;
}

async function ensureColumn(conn, table, column, definition) {
  if (!(await columnExists(conn, table, column))) {
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function indexExists(conn, table, index) {
  const [[row]] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return row.c > 0;
}

async function ensureIndex(conn, table, index, columns) {
  if (!(await indexExists(conn, table, index))) {
    await conn.query(`CREATE INDEX ${index} ON ${table} (${columns})`);
  }
}

export async function initDb() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        google_sub VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        picture VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS plants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name VARCHAR(255) NOT NULL,
        species VARCHAR(255),
        location VARCHAR(255),
        acquired_date DATE,
        notes TEXT,
        photo_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS care_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plant_id INT NOT NULL,
        type ENUM('watering', 'fertilizing', 'repotting', 'pruning', 'observation') NOT NULL,
        notes TEXT,
        photo_url VARCHAR(500),
        logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS care_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plant_id INT NOT NULL,
        type ENUM('watering', 'fertilizing') NOT NULL,
        interval_days INT NOT NULL,
        last_done DATE,
        next_due DATE,
        notify_enabled TINYINT(1) NOT NULL DEFAULT 1,
        notify_days_before INT NOT NULL DEFAULT 0,
        FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
        UNIQUE KEY unique_plant_type (plant_id, type)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        endpoint VARCHAR(767) NOT NULL UNIQUE,
        p256dh VARCHAR(500) NOT NULL,
        auth VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add ownership columns to tables that predate multi-user support.
    await ensureColumn(conn, 'plants', 'user_id', 'INT');
    await ensureIndex(conn, 'plants', 'idx_plants_user', 'user_id');
    await ensureColumn(conn, 'push_subscriptions', 'user_id', 'INT');
    await ensureIndex(conn, 'push_subscriptions', 'idx_push_user', 'user_id');
  } finally {
    conn.release();
  }
}

export default pool;
