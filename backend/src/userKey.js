// ABOUTME: Stores and retrieves each user's API key, encrypted at rest.
import { query } from './db.js';
import { encrypt, decrypt } from './crypto.js';

function maskKey(key) {
  if (key.length <= 11) return '••••';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export async function setUserApiKey(userId, apiKey) {
  const rows = await query('UPDATE users SET anthropic_key = $1, anthropic_key_hint = $2 WHERE id = $3 RETURNING id', [encrypt(apiKey), maskKey(apiKey), userId]);
  if (rows.length === 0) throw new Error(`No user found with id=${userId} — try logging out and back in`);
}

export async function clearUserApiKey(userId) {
  await query('UPDATE users SET anthropic_key = NULL, anthropic_key_hint = NULL WHERE id = $1', [userId]);
}

export async function getUserApiKey(userId) {
  const rows = await query('SELECT anthropic_key FROM users WHERE id = $1', [userId]);
  if (!rows[0]?.anthropic_key) return null;
  return decrypt(rows[0].anthropic_key);
}

export async function getUserKeyInfo(userId) {
  const rows = await query('SELECT anthropic_key_hint FROM users WHERE id = $1', [userId]);
  return { hasKey: !!rows[0]?.anthropic_key_hint, keyHint: rows[0]?.anthropic_key_hint || '' };
}
