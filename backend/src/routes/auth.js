// ABOUTME: Auth endpoints — exchange a Google ID token for an app JWT, and report the current user.
import { Router } from 'express';
import { verifyGoogleToken, upsertUser, signToken, requireAuth } from '../auth.js';
import { query } from '../db.js';

const router = Router();

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, picture: user.picture };
}

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

  let payload;
  try {
    payload = await verifyGoogleToken(credential);
  } catch {
    return res.status(401).json({ error: 'Invalid Google credential' });
  }

  const user = await upsertUser(payload);
  const token = signToken(user.id);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(publicUser(rows[0]));
});

export default router;
