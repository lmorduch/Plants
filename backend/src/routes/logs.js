import { Router } from 'express';
import pool from '../db.js';
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

// GET /plants/:plantId/logs
router.get('/:plantId/logs', async (req, res) => {
  const [logs] = await pool.execute(
    'SELECT * FROM care_logs WHERE plant_id = ? ORDER BY logged_at DESC',
    [req.params.plantId]
  );
  res.json(logs);
});

// POST /plants/:plantId/logs
router.post('/:plantId/logs', upload.single('photo'), async (req, res) => {
  const { type, notes } = req.body;
  const photo_url = req.file ? `/uploads/logs/${req.file.filename}` : null;
  const plant_id = req.params.plantId;

  const [result] = await pool.execute(
    'INSERT INTO care_logs (plant_id, type, notes, photo_url) VALUES (?, ?, ?, ?)',
    [plant_id, type, notes || null, photo_url]
  );

  // Update care schedule last_done and next_due if watering/fertilizing
  if (type === 'watering' || type === 'fertilizing') {
    const today = new Date().toISOString().split('T')[0];
    const [[schedule]] = await pool.execute(
      'SELECT * FROM care_schedules WHERE plant_id = ? AND type = ?',
      [plant_id, type]
    );
    if (schedule) {
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + schedule.interval_days);
      await pool.execute(
        'UPDATE care_schedules SET last_done = ?, next_due = ? WHERE id = ?',
        [today, nextDue.toISOString().split('T')[0], schedule.id]
      );
    }
  }

  const [[log]] = await pool.execute('SELECT * FROM care_logs WHERE id = ?', [result.insertId]);
  res.status(201).json(log);
});

// DELETE /plants/:plantId/logs/:logId
router.delete('/:plantId/logs/:logId', async (req, res) => {
  const [result] = await pool.execute(
    'DELETE FROM care_logs WHERE id = ? AND plant_id = ?',
    [req.params.logId, req.params.plantId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Log not found' });
  res.json({ success: true });
});

export default router;
