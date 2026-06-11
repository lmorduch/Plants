// ABOUTME: CRUD routes for plants, scoped to the authenticated user.
// ABOUTME: All queries filter by user_id so users only see their own plants.
import { Router } from 'express';
import { query } from '../db.js';
import multer from 'multer';
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
  const plants = await query(`
    SELECT p.*,
      (SELECT logged_at FROM care_logs WHERE plant_id = p.id AND type = 'watering' ORDER BY logged_at DESC LIMIT 1) AS last_watered,
      (SELECT logged_at FROM care_logs WHERE plant_id = p.id AND type = 'fertilizing' ORDER BY logged_at DESC LIMIT 1) AS last_fertilized,
      cs_w.next_due AS water_next_due,
      cs_f.next_due AS fertilize_next_due
    FROM plants p
    LEFT JOIN care_schedules cs_w ON cs_w.plant_id = p.id AND cs_w.type = 'watering'
    LEFT JOIN care_schedules cs_f ON cs_f.plant_id = p.id AND cs_f.type = 'fertilizing'
    WHERE p.user_id = $1
    ORDER BY p.location IS NULL, p.location, p.name
  `, [req.userId]);
  res.json(plants);
});

// GET /plants/:id
router.get('/:id', async (req, res) => {
  const rows = await query('SELECT * FROM plants WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  const plant = rows[0];
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  const logs = await query('SELECT * FROM care_logs WHERE plant_id = $1 ORDER BY logged_at DESC LIMIT 50', [req.params.id]);
  const schedules = await query('SELECT * FROM care_schedules WHERE plant_id = $1', [req.params.id]);

  res.json({ ...plant, logs, schedules });
});

// POST /plants
router.post('/', upload.single('photo'), async (req, res) => {
  const { name, species, location, acquired_date, notes, sun_preference, fun_facts, history_and_origin, extra_notes, pet_safe, pet_safety_notes, life_cycle } = req.body;
  const photo_url = req.file ? `/uploads/plants/${req.file.filename}` : null;
  const funFactsJson = fun_facts ? JSON.stringify(typeof fun_facts === 'string' ? JSON.parse(fun_facts) : fun_facts) : null;

  const rows = await query(
    `INSERT INTO plants (user_id, name, species, location, acquired_date, notes, photo_url, sun_preference, fun_facts, history_and_origin, extra_notes, pet_safe, pet_safety_notes, life_cycle)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [req.userId, name, species||null, location||null, acquired_date||null, notes||null, photo_url, sun_preference||null, funFactsJson, history_and_origin||null, extra_notes||null, pet_safe||null, pet_safety_notes||null, life_cycle||null]
  );
  res.status(201).json(rows[0]);
});

// PUT /plants/:id
router.put('/:id', upload.single('photo'), async (req, res) => {
  const { name, species, location, acquired_date, notes, sun_preference, fun_facts, history_and_origin, extra_notes, pet_safe, pet_safety_notes, life_cycle } = req.body;
  const existing = (await query('SELECT * FROM plants WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]))[0];
  if (!existing) return res.status(404).json({ error: 'Plant not found' });

  const photo_url = req.file ? `/uploads/plants/${req.file.filename}` : existing.photo_url;
  const funFactsJson = fun_facts ? JSON.stringify(typeof fun_facts === 'string' ? JSON.parse(fun_facts) : fun_facts) : existing.fun_facts;

  const rows = await query(
    `UPDATE plants SET name=$1, species=$2, location=$3, acquired_date=$4, notes=$5, photo_url=$6,
     sun_preference=$7, fun_facts=$8, history_and_origin=$9, extra_notes=$10, pet_safe=$11,
     pet_safety_notes=$12, life_cycle=$13, updated_at=NOW()
     WHERE id=$14 AND user_id=$15 RETURNING *`,
    [name, species||null, location||null, acquired_date||null, notes||null, photo_url,
     sun_preference||null, funFactsJson, history_and_origin||existing.history_and_origin||null,
     extra_notes||existing.extra_notes||null, pet_safe||existing.pet_safe||null,
     pet_safety_notes||existing.pet_safety_notes||null, life_cycle||existing.life_cycle||null,
     req.params.id, req.userId]
  );
  res.json(rows[0]);
});

// DELETE /plants/:id
router.delete('/:id', async (req, res) => {
  const rows = await query('DELETE FROM plants WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Plant not found' });
  res.json({ success: true });
});

export default router;
