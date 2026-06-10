// ABOUTME: Care schedule routes — upsert and list schedules per plant, and upcoming dashboard.
// ABOUTME: Verifies plant ownership against req.userId before every operation.
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

async function ownedPlant(plantId, userId) {
  const [[plant]] = await pool.execute(
    'SELECT id FROM plants WHERE id = ? AND user_id = ?',
    [plantId, userId]
  );
  return plant || null;
}

// GET /plants/:plantId/schedules
router.get('/:plantId/schedules', async (req, res) => {
  if (!await ownedPlant(req.params.plantId, req.userId)) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  const [schedules] = await pool.execute(
    'SELECT * FROM care_schedules WHERE plant_id = ?',
    [req.params.plantId]
  );
  res.json(schedules);
});

// PUT /plants/:plantId/schedules/:type  (upsert)
router.put('/:plantId/schedules/:type', async (req, res) => {
  if (!await ownedPlant(req.params.plantId, req.userId)) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  const { interval_days, last_done, notify_enabled = 1, notify_days_before = 0 } = req.body;
  const { plantId, type } = req.params;

  const nextDue = last_done
    ? (() => {
        const d = new Date(last_done);
        d.setDate(d.getDate() + Number(interval_days));
        return d.toISOString().split('T')[0];
      })()
    : new Date().toISOString().split('T')[0];

  await pool.execute(
    `INSERT INTO care_schedules (plant_id, type, interval_days, last_done, next_due, notify_enabled, notify_days_before)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       interval_days = VALUES(interval_days),
       last_done = VALUES(last_done),
       next_due = VALUES(next_due),
       notify_enabled = VALUES(notify_enabled),
       notify_days_before = VALUES(notify_days_before)`,
    [plantId, type, interval_days, last_done || null, nextDue, notify_enabled ? 1 : 0, notify_days_before]
  );

  const [[schedule]] = await pool.execute(
    'SELECT * FROM care_schedules WHERE plant_id = ? AND type = ?',
    [plantId, type]
  );
  res.json(schedule);
});

// GET /schedule/upcoming  — plants due in the next N days for this user
router.get('/upcoming', async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const [rows] = await pool.execute(
    `SELECT cs.*, p.name AS plant_name, p.photo_url
     FROM care_schedules cs
     JOIN plants p ON p.id = cs.plant_id
     WHERE p.user_id = ?
       AND cs.next_due <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY cs.next_due ASC`,
    [req.userId, days]
  );
  res.json(rows);
});

export default router;
