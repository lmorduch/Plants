import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /plants/:plantId/schedules
router.get('/:plantId/schedules', async (req, res) => {
  const [schedules] = await pool.execute(
    'SELECT * FROM care_schedules WHERE plant_id = ?',
    [req.params.plantId]
  );
  res.json(schedules);
});

// PUT /plants/:plantId/schedules/:type  (upsert)
router.put('/:plantId/schedules/:type', async (req, res) => {
  const { interval_days, last_done } = req.body;
  const { plantId, type } = req.params;

  const nextDue = last_done
    ? (() => {
        const d = new Date(last_done);
        d.setDate(d.getDate() + Number(interval_days));
        return d.toISOString().split('T')[0];
      })()
    : new Date().toISOString().split('T')[0];

  await pool.execute(
    `INSERT INTO care_schedules (plant_id, type, interval_days, last_done, next_due)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE interval_days = VALUES(interval_days), last_done = VALUES(last_done), next_due = VALUES(next_due)`,
    [plantId, type, interval_days, last_done || null, nextDue]
  );

  const [[schedule]] = await pool.execute(
    'SELECT * FROM care_schedules WHERE plant_id = ? AND type = ?',
    [plantId, type]
  );
  res.json(schedule);
});

// GET /schedule/upcoming  — plants due in the next N days
router.get('/upcoming', async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const [rows] = await pool.execute(
    `SELECT cs.*, p.name AS plant_name, p.photo_url
     FROM care_schedules cs
     JOIN plants p ON p.id = cs.plant_id
     WHERE cs.next_due <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY cs.next_due ASC`,
    [days]
  );
  res.json(rows);
});

export default router;
