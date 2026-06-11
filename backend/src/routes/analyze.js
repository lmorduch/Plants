import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import { getUserApiKey } from '../userKey.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const IDENTIFY_SCHEMA = `{
  "common_name": "",
  "scientific_name": "",
  "description": "",
  "care": {
    "light": "",
    "humidity": "",
    "temperature": "",
    "watering": {
      "typical_days": 7,
      "spring_days": null,
      "summer_days": null,
      "fall_days": null,
      "winter_days": null,
      "notes": ""
    },
    "fertilizing": {
      "typical_days": 30,
      "spring_days": null,
      "summer_days": null,
      "fall_days": null,
      "winter_days": null,
      "notes": ""
    }
  },
  "fun_facts": [],
  "history_and_origin": "",
  "pet_safe": "safe",
  "pet_safety_notes": "",
  "extra_notes": ""
}`;

const IDENTIFY_INSTRUCTIONS = `Provide:
1. Common name
2. Scientific name
3. Brief description (2-3 sentences)
4. Light requirements
5. Watering schedule — typical days between waterings, seasonal variations (spring/summer/fall/winter may differ), and a short care note
6. Fertilizing schedule — typical days between feedings, seasonal variations, and a short care note
7. Humidity preference
8. Temperature range
9. Interesting facts (1-2 items)
10. History and origin (2-4 sentences on where it comes from, cultural significance, how it spread)
11. Pet safety — "safe", "toxic", or "caution". Brief note on symptoms if toxic.
12. Extra notes — pest risks, pruning, repotting, etc.

Respond ONLY in JSON with this exact shape:
${IDENTIFY_SCHEMA}`;

function parseAiJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse AI response');
  return JSON.parse(match[0]);
}

// POST /analyze — identify plant or assess health from a photo
router.post('/', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo provided' });

  const apiKey = req.headers['x-gemini-api-key'] || await getUserApiKey(req.userId) || process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(401).json({ error: 'No API key configured. Add your Gemini API key in Settings.', code: 'NO_API_KEY' });

  const { mode = 'identify' } = req.body;
  const base64 = req.file.buffer.toString('base64');
  const mediaType = req.file.mimetype;

  const prompt = mode === 'identify'
    ? `You are a plant identification expert. Analyze this plant photo and ${IDENTIFY_INSTRUCTIONS}`
    : `You are a plant health expert. Analyze this plant photo and provide a health assessment:
1. Overall health score (1-10)
2. Health status (Excellent / Good / Fair / Poor / Critical)
3. Observations — list what you see (color, leaves, soil, etc.)
4. Issues detected — list any problems (pests, disease, deficiencies, overwatering, etc.)
5. Recommendations — specific action steps to improve health

Respond in JSON with keys: health_score, health_status, observations (array), issues (array), recommendations (array).`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([
      { inlineData: { mimeType: mediaType, data: base64 } },
      prompt,
    ]);
    res.json(parseAiJson(result.response.text()));
  } catch (err) {
    console.error('Gemini analyze error:', err);
    res.status(500).json({ error: err?.message || 'AI request failed' });
  }
});

// POST /analyze/by-name — fetch plant data by name/species (no photo needed)
router.post('/by-name', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const apiKey = req.headers['x-gemini-api-key'] || await getUserApiKey(req.userId) || process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(401).json({ error: 'No API key configured. Add your Gemini API key in Settings.', code: 'NO_API_KEY' });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(
      `You are a plant expert. For the plant "${name.trim()}", ${IDENTIFY_INSTRUCTIONS}`
    );
    res.json(parseAiJson(result.response.text()));
  } catch (err) {
    console.error('Gemini by-name error:', err);
    res.status(500).json({ error: err?.message || 'AI request failed' });
  }
});

// POST /analyze/bulk — identify multiple plants in one photo with bounding boxes
router.post('/bulk', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo provided' });

  const apiKey = req.headers['x-gemini-api-key'] || await getUserApiKey(req.userId) || process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(401).json({ error: 'No API key configured.', code: 'NO_API_KEY' });

  const base64 = req.file.buffer.toString('base64');
  const mediaType = req.file.mimetype;

  const plantSchema = `{
  "common_name": "",
  "scientific_name": "",
  "bbox": { "x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0 },
  "description": "",
  "care": {
    "light": "",
    "humidity": "",
    "temperature": "",
    "watering": { "typical_days": 7, "spring_days": null, "summer_days": null, "fall_days": null, "winter_days": null, "notes": "" },
    "fertilizing": { "typical_days": 30, "spring_days": null, "summer_days": null, "fall_days": null, "winter_days": null, "notes": "" }
  },
  "fun_facts": [],
  "history_and_origin": "",
  "pet_safe": "safe",
  "pet_safety_notes": "",
  "extra_notes": ""
}`;

  const prompt = `You are a plant identification expert. Look at this photo and identify every distinct plant you can see.

For each plant:
1. Identify the species and provide full care information
2. Provide a bounding box (bbox) as normalized fractions of the image dimensions (0.0 to 1.0):
   - x1, y1: top-left corner of the plant (x = left→right, y = top→bottom)
   - x2, y2: bottom-right corner
   - Make the box tight around the plant's visible foliage/pot

Be conservative: only include plants you can identify with reasonable confidence. If the same plant appears multiple times, include each instance separately.

Respond ONLY in JSON with this exact shape:
{
  "plants": [
    ${plantSchema}
  ]
}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([
      { inlineData: { mimeType: mediaType, data: base64 } },
      prompt,
    ]);
    const parsed = parseAiJson(result.response.text());
    if (!Array.isArray(parsed.plants)) return res.status(500).json({ error: 'Unexpected AI response shape' });
    res.json(parsed);
  } catch (err) {
    console.error('Gemini bulk error:', err);
    res.status(500).json({ error: err?.message || 'AI request failed' });
  }
});

export default router;
