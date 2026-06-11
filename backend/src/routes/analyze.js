import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import { getUserApiKey } from '../userKey.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /analyze  — identify plant or assess health from a photo
router.post('/', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo provided' });

  const apiKey = req.headers['x-gemini-api-key'] || await getUserApiKey(req.userId) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: 'No API key configured. Add your Gemini API key in Settings.', code: 'NO_API_KEY' });
  }

  const { mode = 'identify' } = req.body; // 'identify' | 'health'
  const base64 = req.file.buffer.toString('base64');
  const mediaType = req.file.mimetype;

  const prompt =
    mode === 'identify'
      ? `You are a plant identification expert. Analyze this plant photo and provide:
1. Common name
2. Scientific name
3. Brief description (2-3 sentences)
4. Light requirements
5. Watering schedule — typical days between waterings, seasonal variations (spring/summer/fall/winter may differ), and a short care note (e.g. "water when top inch is dry")
6. Fertilizing schedule — typical days between feedings, seasonal variations, and a short care note
7. Humidity preference
8. Temperature range
9. Interesting facts (1-2 items)
10. History and origin (2-4 sentences on where it comes from, cultural significance, how it spread)
11. Extra notes — any other important care info that doesn't fit above (pest risks, toxicity, pruning, repotting, etc.)

Respond ONLY in JSON with this exact shape:
{
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
  "extra_notes": ""
}`
      : `You are a plant health expert. Analyze this plant photo and provide a health assessment:
1. **Overall health score** (1-10)
2. **Health status** (Excellent / Good / Fair / Poor / Critical)
3. **Observations** — list what you see (color, leaves, soil, etc.)
4. **Issues detected** — list any problems (pests, disease, deficiencies, overwatering, etc.)
5. **Recommendations** — specific action steps to improve health

Respond in JSON with keys: health_score, health_status, observations (array), issues (array), recommendations (array).`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      { inlineData: { mimeType: mediaType, data: base64 } },
      prompt,
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse AI response', raw: text });

    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error('Gemini analyze error:', err);
    const message = err?.message || 'AI request failed';
    res.status(500).json({ error: message });
  }
});

export default router;
