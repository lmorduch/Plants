// ABOUTME: Tests for symmetric encryption of secrets (the stored Anthropic API key).
// ABOUTME: Uses real AES-256-GCM (no mocks) to verify round-trip and tamper detection.
import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from './crypto.js';

beforeEach(() => {
  process.env.APP_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes of hex
});

describe('encrypt / decrypt', () => {
  it('round-trips a secret back to the original plaintext', () => {
    const secret = 'sk-ant-api03-some-secret-value';
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('produces ciphertext that is not the plaintext', () => {
    const secret = 'sk-ant-api03-some-secret-value';
    const blob = encrypt(secret);
    expect(blob).not.toContain(secret);
  });

  it('produces a different blob each time (random IV)', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'));
  });

  it('throws when the ciphertext has been tampered with', () => {
    const blob = encrypt('secret');
    const [iv, tag, data] = blob.split(':');
    const flipped = data[0] === '0' ? '1' : '0';
    const tampered = `${iv}:${tag}:${flipped}${data.slice(1)}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws when decrypting with a different key', () => {
    const blob = encrypt('secret');
    process.env.APP_ENCRYPTION_KEY = 'b'.repeat(64);
    expect(() => decrypt(blob)).toThrow();
  });

  it('throws when the encryption key is missing or malformed', () => {
    process.env.APP_ENCRYPTION_KEY = 'too-short';
    expect(() => encrypt('secret')).toThrow();
  });
});
