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
1. **Common name** of the plant
2. **Scientific name**
3. **Brief description** (2-3 sentences)
4. **Care tips**:
   - Light requirements
   - Watering frequency (how many days between waterings)
   - Fertilizing frequency (how many days between feedings)
   - Humidity preference
   - Temperature range
5. **Interesting facts** (1-2 bullet points)

Respond in JSON with keys: common_name, scientific_name, description, care (object with: light, watering_days, fertilizing_days, humidity, temperature), fun_facts (array).`
      : `You are a plant health expert. Analyze this plant photo and provide a health assessment:
1. **Overall health score** (1-10)
2. **Health status** (Excellent / Good / Fair / Poor / Critical)
3. **Observations** — list what you see (color, leaves, soil, etc.)
4. **Issues detected** — list any problems (pests, disease, deficiencies, overwatering, etc.)
5. **Recommendations** — specific action steps to improve health

Respond in JSON with keys: health_score, health_status, observations (array), issues (array), recommendations (array).`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

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
