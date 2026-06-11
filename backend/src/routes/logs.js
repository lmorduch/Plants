// ABOUTME: Care log routes — create, list, delete logs for a plant.
// ABOUTME: Verifies plant ownership against req.userId before every operation.
import { Router } from 'express';
import { query } from '../db.js';
import multer from 'multer';
import fs from 'fs';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/logs';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function ownedPlant(plantId, userId) {
  const rows = await query('SELECT id FROM plants WHERE id = $1 AND user_id = $2', [plantId, userId]);
  return rows[0] || null;
}

// GET /plants/:plantId/logs
router.get('/:plantId/logs', async (req, res) => {
  if (!await ownedPlant(req.params.plantId, req.userId)) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  const logs = await query('SELECT * FROM care_logs WHERE plant_id = $1 ORDER BY logged_at DESC', [req.params.plantId]);
  res.json(logs);
});

// POST /plants/:plantId/logs
router.post('/:plantId/logs', upload.single('photo'), async (req, res) => {
  if (!await ownedPlant(req.params.plantId, req.userId)) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  const { type, notes } = req.body;
  const photo_url = req.file ? `/uploads/logs/${req.file.filename}` : null;
  const plant_id = req.params.plantId;

  const rows = await query(
    'INSERT INTO care_logs (plant_id, type, notes, photo_url) VALUES ($1,$2,$3,$4) RETURNING *',
    [plant_id, type, notes||null, photo_url]
  );

  if (type === 'watering' || type === 'fertilizing') {
    const today = new Date().toISOString().split('T')[0];
    const scheduleRows = await query('SELECT * FROM care_schedules WHERE plant_id = $1 AND type = $2', [plant_id, type]);
    const schedule = scheduleRows[0];
    if (schedule) {
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + schedule.interval_days);
      await query('UPDATE care_schedules SET last_done = $1, next_due = $2 WHERE id = $3', [today, nextDue.toISOString().split('T')[0], schedule.id]);
    }
  }

  res.status(201).json(rows[0]);
});

// DELETE /plants/:plantId/logs/:logId
router.delete('/:plantId/logs/:logId', async (req, res) => {
  if (!await ownedPlant(req.params.plantId, req.userId)) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  const rows = await query('DELETE FROM care_logs WHERE id = $1 AND plant_id = $2 RETURNING id', [req.params.logId, req.params.plantId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Log not found' });
  res.json({ success: true });
});

export default router;
