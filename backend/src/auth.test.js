// ABOUTME: Tests for JWT issuing/verification and the requireAuth middleware.
// ABOUTME: Uses real jsonwebtoken (no mocks) to validate auth gating behavior.
import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken, requireAuth } from './auth.js';

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
});

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('signToken / verifyToken', () => {
  it('round-trips the user id as the token subject', () => {
    const token = signToken(42);
    const payload = verifyToken(token);
    expect(payload.sub).toBe(42);
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ sub: 1 }, 'wrong-secret');
    expect(() => verifyToken(forged)).toThrow();
  });
});

describe('requireAuth', () => {
  it('responds 401 when the Authorization header is missing', () => {
    const req = { headers: {} };
    const res = mockRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('responds 401 when the token is invalid', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('sets req.userId and calls next for a valid Bearer token', () => {
    const req = { headers: { authorization: `Bearer ${signToken(7)}` } };
    const res = mockRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.userId).toBe(7);
    expect(res.statusCode).toBe(null);
  });
});
