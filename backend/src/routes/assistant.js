import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pool from '../db.js';
import { getUserApiKey } from '../userKey.js';

const router = Router();

function buildSystemPrompt(plant, logs, schedules) {
  const waterSched = schedules.find(s => s.type === 'watering');
  const fertSched = schedules.find(s => s.type === 'fertilizing');

  const recentLogs = logs.slice(0, 10).map(l =>
    `  - ${new Date(l.logged_at).toLocaleDateString()}: ${l.type}${l.notes ? ` — "${l.notes}"` : ''}`
  ).join('\n') || '  (none yet)';

  return `You are a warm, knowledgeable plant care assistant helping the owner of a specific plant. Here is everything you know about this plant:

PLANT PROFILE
  Name: ${plant.name}
  Species: ${plant.species || 'Unknown'}
  Location: ${plant.location || 'Not specified'}
  Acquired: ${plant.acquired_date ? new Date(plant.acquired_date).toLocaleDateString() : 'Unknown'}
  Notes: ${plant.notes || 'None'}

CARE SCHEDULES
  Watering: ${waterSched ? `every ${waterSched.interval_days} days (next due: ${waterSched.next_due ? new Date(waterSched.next_due).toLocaleDateString() : 'not set'})` : 'not configured'}
  Fertilizing: ${fertSched ? `every ${fertSched.interval_days} days (next due: ${fertSched.next_due ? new Date(fertSched.next_due).toLocaleDateString() : 'not set'})` : 'not configured'}

RECENT CARE LOG (last 10 entries)
${recentLogs}

YOUR ROLE
- Answer questions about this specific plant's needs, health, and care
- Give actionable, practical advice tailored to what you know about this plant
- If asked about problems (yellow leaves, pests, drooping, etc.), diagnose based on the care history
- Suggest schedule adjustments if the current plan seems off
- Be conversational and encouraging — plant care should be fun
- Keep responses concise unless the user asks for detail
- If you don't know the species, say so and ask for more info rather than guessing`;
}

// POST /api/assistant/:plantId/chat
router.post('/:plantId/chat', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const apiKey = req.headers['x-gemini-api-key'] || await getUserApiKey(req.userId) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(401).json({
      error: 'No API key. Add your Gemini API key in Settings, or ask the app owner to configure one.',
      code: 'NO_API_KEY',
    });
  }

  const [[plant]] = await pool.execute(
    'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    [req.params.plantId, req.userId]
  );
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  const [logs] = await pool.execute(
    'SELECT * FROM care_logs WHERE plant_id = ? ORDER BY logged_at DESC LIMIT 20',
    [req.params.plantId]
  );
  const [schedules] = await pool.execute(
    'SELECT * FROM care_schedules WHERE plant_id = ?',
    [req.params.plantId]
  );

  const systemPrompt = buildSystemPrompt(plant, logs, schedules);
  const validMessages = messages.filter(m => m.role && m.content);

  // Gemini uses 'user' / 'model' roles; history excludes the final message
  const history = validMessages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const lastMessage = validMessages[validMessages.length - 1];

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);

    res.json({ reply: result.response.text() });
  } catch (err) {
    console.error('Gemini assistant error:', err);
    const message = err?.message || 'AI request failed';
    res.status(500).json({ error: message });
  }
});

export default router;
