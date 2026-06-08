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

export async function initDb() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS plants (
        id INT AUTO_INCREMENT PRIMARY KEY,
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
        endpoint VARCHAR(1000) NOT NULL UNIQUE,
        p256dh VARCHAR(500) NOT NULL,
        auth VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    conn.release();
  }
}

export default pool;
