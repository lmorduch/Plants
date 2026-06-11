// ABOUTME: Authentication for the app — verifies Google ID tokens, issues app JWTs,
// ABOUTME: upserts users, and guards routes via the requireAuth middleware.
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { query } from './db.js';

const TOKEN_TTL = '30d';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

export async function upsertUser({ sub, email, name, picture }) {
  await query(
    `INSERT INTO users (google_sub, email, name, picture)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (google_sub) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, picture=EXCLUDED.picture`,
    [sub, email, name||null, picture||null]
  );
  const rows = await query('SELECT * FROM users WHERE google_sub = $1', [sub]);
  return rows[0];
}
