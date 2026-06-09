// ABOUTME: Authentication for the app — verifies Google ID tokens, issues app JWTs,
// ABOUTME: upserts users, and guards routes via the requireAuth middleware.
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import pool from './db.js';

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

// Verifies a Google ID token and returns its profile payload.
export async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

// Creates the user if new (matched by Google subject id) and returns the row.
export async function upsertUser({ sub, email, name, picture }) {
  await pool.execute(
    `INSERT INTO users (google_sub, email, name, picture)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), name = VALUES(name), picture = VALUES(picture)`,
    [sub, email, name || null, picture || null]
  );
  const [[user]] = await pool.execute('SELECT * FROM users WHERE google_sub = ?', [sub]);
  return user;
}
