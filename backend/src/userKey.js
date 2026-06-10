// ABOUTME: Stores and retrieves each user's Anthropic API key, encrypted at rest.
// ABOUTME: Keeps a non-sensitive masked hint alongside the ciphertext for display.
import pool from './db.js';
import { encrypt, decrypt } from './crypto.js';

function maskKey(key) {
  if (key.length <= 11) return '••••';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export async function setUserApiKey(userId, apiKey) {
  await pool.execute(
    'UPDATE users SET anthropic_key = ?, anthropic_key_hint = ? WHERE id = ?',
    [encrypt(apiKey), maskKey(apiKey), userId]
  );
}

export async function clearUserApiKey(userId) {
  await pool.execute(
    'UPDATE users SET anthropic_key = NULL, anthropic_key_hint = NULL WHERE id = ?',
    [userId]
  );
}

// Returns the decrypted key for use against the Anthropic API, or null if none is set.
export async function getUserApiKey(userId) {
  const [[row]] = await pool.execute('SELECT anthropic_key FROM users WHERE id = ?', [userId]);
  if (!row?.anthropic_key) return null;
  return decrypt(row.anthropic_key);
}

// Returns only display-safe info: whether a key is set and a masked hint.
export async function getUserKeyInfo(userId) {
  const [[row]] = await pool.execute('SELECT anthropic_key_hint FROM users WHERE id = ?', [userId]);
  return { hasKey: !!row?.anthropic_key_hint, keyHint: row?.anthropic_key_hint || '' };
}
