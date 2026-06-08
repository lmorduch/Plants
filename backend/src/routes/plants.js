import { Router } from 'express';
import pool from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/plants';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /plants
router.get('/', async (req, res) => {
  const [plants] = await pool.execute(`
    SELECT p.*,
      (SELECT logged_at FROM care_logs WHERE plant_id = p.id AND type = 'watering' ORDER BY logged_at DESC LIMIT 1) AS last_watered,
      (SELECT logged_at FROM care_logs WHERE plant_id = p.id AND type = 'fertilizing' ORDER BY logged_at DESC LIMIT 1) AS last_fertilized,
      cs_w.next_due AS water_next_due,
      cs_f.next_due AS fertilize_next_due
    FROM plants p
    LEFT JOIN care_schedules cs_w ON cs_w.plant_id = p.id AND cs_w.type = 'watering'
    LEFT JOIN care_schedules cs_f ON cs_f.plant_id = p.id AND cs_f.type = 'fertilizing'
    ORDER BY p.name
  `);
  res.json(plants);
});

// GET /plants/:id
router.get('/:id', async (req, res) => {
  const [[plant]] = await pool.execute('SELECT * FROM plants WHERE id = ?', [req.params.id]);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  const [logs] = await pool.execute(
    'SELECT * FROM care_logs WHERE plant_id = ? ORDER BY logged_at DESC LIMIT 50',
    [req.params.id]
  );
  const [schedules] = await pool.execute(
    'SELECT * FROM care_schedules WHERE plant_id = ?',
    [req.params.id]
  );

  res.json({ ...plant, logs, schedules });
});

// POST /plants
router.post('/', upload.single('photo'), async (req, res) => {
  const { name, species, location, acquired_date, notes } = req.body;
  const photo_url = req.file ? `/uploads/plants/${req.file.filename}` : null;

  const [result] = await pool.execute(
    'INSERT INTO plants (name, species, location, acquired_date, notes, photo_url) VALUES (?, ?, ?, ?, ?, ?)',
    [name, species || null, location || null, acquired_date || null, notes || null, photo_url]
  );
  const [[plant]] = await pool.execute('SELECT * FROM plants WHERE id = ?', [result.insertId]);
  res.status(201).json(plant);
});

// PUT /plants/:id
router.put('/:id', upload.single('photo'), async (req, res) => {
  const { name, species, location, acquired_date, notes } = req.body;
  const [[existing]] = await pool.execute('SELECT * FROM plants WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Plant not found' });

  const photo_url = req.file ? `/uploads/plants/${req.file.filename}` : existing.photo_url;

  await pool.execute(
    'UPDATE plants SET name=?, species=?, location=?, acquired_date=?, notes=?, photo_url=? WHERE id=?',
    [name, species || null, location || null, acquired_date || null, notes || null, photo_url, req.params.id]
  );
  const [[plant]] = await pool.execute('SELECT * FROM plants WHERE id = ?', [req.params.id]);
  res.json(plant);
});

// DELETE /plants/:id
router.delete('/:id', async (req, res) => {
  const [result] = await pool.execute('DELETE FROM plants WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Plant not found' });
  res.json({ success: true });
});

export default router;
