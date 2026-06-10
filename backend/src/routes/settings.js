// ABOUTME: User settings endpoints — manage the per-user Anthropic API key.
// ABOUTME: Never returns the raw key; only whether one is set plus a masked hint.
import { Router } from 'express';
import { setUserApiKey, clearUserApiKey, getUserKeyInfo } from '../userKey.js';

const router = Router();

// GET /api/settings/api-key  — does the user have a key, and a masked hint
router.get('/api-key', async (req, res) => {
  res.json(await getUserKeyInfo(req.userId));
});

// PUT /api/settings/api-key  { apiKey }  — store an encrypted key
router.put('/api-key', async (req, res) => {
  const apiKey = (req.body.apiKey || '').trim();
  if (!apiKey) return res.status(400).json({ error: 'apiKey is required' });
  await setUserApiKey(req.userId, apiKey);
  res.json(await getUserKeyInfo(req.userId));
});

// DELETE /api/settings/api-key  — remove the stored key
router.delete('/api-key', async (req, res) => {
  await clearUserApiKey(req.userId);
  res.json({ hasKey: false, keyHint: '' });
});

export default router;
