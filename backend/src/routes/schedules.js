// ABOUTME: Care schedule routes — upsert and list schedules per plant, and upcoming dashboard.
// ABOUTME: Verifies plant ownership against req.userId before every operation.
import { Router } from 'express';
import pool from '../db.js';
import { getCurrentSeason, effectiveDays } from '../season.js';

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
  res.json({ schedules, current_season: getCurrentSeason() });
});

// PUT /plants/:plantId/schedules/:type  (upsert)
router.put('/:plantId/schedules/:type', async (req, res) => {
  if (!await ownedPlant(req.params.plantId, req.userId)) {
    return res.status(404).json({ error: 'Plant not found' });
  }

  const {
    interval_days,
    last_done,
    notify_enabled = 1,
    notify_days_before = 0,
    notes,
    spring_days,
    summer_days,
    fall_days,
    winter_days,
  } = req.body;
  const { plantId, type } = req.params;

  // If seasonal values supplied, use current season's value as interval_days.
  const seasonal = { spring_days, summer_days, fall_days, winter_days };
  const hasSeasonalData = Object.values(seasonal).some(v => v != null);
  const activeInterval = hasSeasonalData
    ? (effectiveDays({ interval_days, ...seasonal }) ?? interval_days)
    : interval_days;

  const nextDue = last_done
    ? (() => {
        const d = new Date(last_done);
        d.setDate(d.getDate() + Number(activeInterval));
        return d.toISOString().split('T')[0];
      })()
    : new Date().toISOString().split('T')[0];

  await pool.execute(
    `INSERT INTO care_schedules
       (plant_id, type, interval_days, last_done, next_due, notify_enabled, notify_days_before,
        notes, spring_days, summer_days, fall_days, winter_days)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       interval_days        = VALUES(interval_days),
       last_done            = VALUES(last_done),
       next_due             = VALUES(next_due),
       notify_enabled       = VALUES(notify_enabled),
       notify_days_before   = VALUES(notify_days_before),
       notes                = VALUES(notes),
       spring_days          = VALUES(spring_days),
       summer_days          = VALUES(summer_days),
       fall_days            = VALUES(fall_days),
       winter_days          = VALUES(winter_days)`,
    [
      plantId, type, activeInterval, last_done || null, nextDue,
      notify_enabled ? 1 : 0, notify_days_before,
      notes || null,
      spring_days ?? null, summer_days ?? null, fall_days ?? null, winter_days ?? null,
    ]
  );

  const [[schedule]] = await pool.execute(
    'SELECT * FROM care_schedules WHERE plant_id = ? AND type = ?',
    [plantId, type]
  );
  res.json({ schedule, current_season: getCurrentSeason() });
});

// POST /plants/:plantId/schedules/:type/done  — mark a care task done today
router.post('/:plantId/schedules/:type/done', async (req, res) => {
  if (!await ownedPlant(req.params.plantId, req.userId)) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  const { plantId, type } = req.params;
  const today = new Date().toISOString().split('T')[0];

  const [[sched]] = await pool.execute(
    'SELECT * FROM care_schedules WHERE plant_id = ? AND type = ?',
    [plantId, type]
  );
  if (!sched) return res.status(404).json({ error: 'No schedule for this type' });

  const interval = effectiveDays(sched) ?? sched.interval_days;
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + Number(interval));
  const nextDueStr = nextDue.toISOString().split('T')[0];

  await pool.execute(
    'UPDATE care_schedules SET last_done = ?, next_due = ? WHERE plant_id = ? AND type = ?',
    [today, nextDueStr, plantId, type]
  );
  await pool.execute(
    'INSERT INTO care_logs (plant_id, type, logged_at, notes) VALUES (?, ?, NOW(), ?)',
    [plantId, type === 'watering' ? 'watering' : 'fertilizing', null]
  );

  res.json({ last_done: today, next_due: nextDueStr });
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
