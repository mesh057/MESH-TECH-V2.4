'use strict';

const crypto = require('crypto');

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const usedNonces = new Map();

function prune(now) {
  for (const [nonce, expiresAt] of usedNonces) {
    if (expiresAt <= now) usedNonces.delete(nonce);
  }
}

function bodyHash(body) {
  return crypto.createHash('sha256').update(body || '', 'utf8').digest('hex');
}

function canonical(method, path, timestamp, nonce, body, scope) {
  return [String(method).toUpperCase(), path, timestamp, nonce, scope, bodyHash(body)].join('\n');
}

function verifyBridgeRequest(secret, input, now = Date.now()) {
  prune(now);
  if (!secret || !input || !input.timestamp || !input.nonce || !input.signature) return { ok: false, error: 'missing_auth' };
  if (!['status:read', 'control:write'].includes(input.scope)) return { ok: false, error: 'invalid_scope' };
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > MAX_CLOCK_SKEW_MS) return { ok: false, error: 'stale_request' };
  if (usedNonces.has(input.nonce)) return { ok: false, error: 'replayed_request' };
  const expected = crypto.createHmac('sha256', secret).update(canonical(input.method, input.path, input.timestamp, input.nonce, input.body || '', input.scope), 'utf8').digest('hex');
  const supplied = Buffer.from(String(input.signature), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (supplied.length !== expectedBuffer.length || !crypto.timingSafeEqual(supplied, expectedBuffer)) return { ok: false, error: 'invalid_signature' };
  usedNonces.set(input.nonce, now + MAX_CLOCK_SKEW_MS);
  return { ok: true, scope: input.scope };
}

function resetBridgeNoncesForTests() {
  usedNonces.clear();
}

module.exports = { verifyBridgeRequest, resetBridgeNoncesForTests, canonical };
