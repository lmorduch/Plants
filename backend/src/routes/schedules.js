// ABOUTME: Care schedule routes — upsert and list schedules per plant, and upcoming dashboard.
// ABOUTME: Verifies plant ownership against req.userId before every operation.
import { Router } from 'express';
import { query } from '../db.js';
import { getCurrentSeason, effectiveDays } from '../season.js';

const router = Router();

async function ownedPlant(plantId, userId) {
  const rows = await query('SELECT id FROM plants WHERE id = $1 AND user_id = $2', [plantId, userId]);
  return rows[0] || null;
}

// GET /plants/:plantId/schedules
router.get('/:plantId/schedules', async (req, res) => {
  if (!await ownedPlant(req.params.plantId, req.userId)) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  const schedules = await query('SELECT * FROM care_schedules WHERE plant_id = $1', [req.params.plantId]);
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
    notify_enabled = true,
    notify_days_before = 0,
    notes,
    spring_days,
    summer_days,
    fall_days,
    winter_days,
  } = req.body;
  const { plantId, type } = req.params;

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

  await query(
    `INSERT INTO care_schedules
       (plant_id, type, interval_days, last_done, next_due, notify_enabled, notify_days_before,
        notes, spring_days, summer_days, fall_days, winter_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (plant_id, type) DO UPDATE SET
       interval_days      = EXCLUDED.interval_days,
       last_done          = EXCLUDED.last_done,
       next_due           = EXCLUDED.next_due,
       notify_enabled     = EXCLUDED.notify_enabled,
       notify_days_before = EXCLUDED.notify_days_before,
       notes              = EXCLUDED.notes,
       spring_days        = EXCLUDED.spring_days,
       summer_days        = EXCLUDED.summer_days,
       fall_days          = EXCLUDED.fall_days,
       winter_days        = EXCLUDED.winter_days`,
    [
      plantId, type, activeInterval, last_done||null, nextDue,
      notify_enabled ? true : false, notify_days_before,
      notes||null,
      spring_days??null, summer_days??null, fall_days??null, winter_days??null,
    ]
  );

  const rows = await query('SELECT * FROM care_schedules WHERE plant_id = $1 AND type = $2', [plantId, type]);
  res.json({ schedule: rows[0], current_season: getCurrentSeason() });
});

// POST /plants/:plantId/schedules/:type/done  — mark a care task done today
router.post('/:plantId/schedules/:type/done', async (req, res) => {
  if (!await ownedPlant(req.params.plantId, req.userId)) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  const { plantId, type } = req.params;
  const today = new Date().toISOString().split('T')[0];

  const schedRows = await query('SELECT * FROM care_schedules WHERE plant_id = $1 AND type = $2', [plantId, type]);
  const sched = schedRows[0];
  if (!sched) return res.status(404).json({ error: 'No schedule for this type' });

  const interval = effectiveDays(sched) ?? sched.interval_days;
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + Number(interval));
  const nextDueStr = nextDue.toISOString().split('T')[0];

  await query('UPDATE care_schedules SET last_done = $1, next_due = $2 WHERE plant_id = $3 AND type = $4', [today, nextDueStr, plantId, type]);
  await query('INSERT INTO care_logs (plant_id, type) VALUES ($1, $2)', [plantId, type]);

  res.json({ last_done: today, next_due: nextDueStr });
});

// GET /schedule/upcoming  — plants due in the next N days for this user
router.get('/upcoming', async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const rows = await query(
    `SELECT cs.*, p.name AS plant_name, p.photo_url
     FROM care_schedules cs
     JOIN plants p ON p.id = cs.plant_id
     WHERE p.user_id = $1
       AND cs.next_due <= CURRENT_DATE + ($2 || ' days')::INTERVAL
     ORDER BY cs.next_due ASC`,
    [req.userId, days]
  );
  res.json(rows);
});

export default router;
