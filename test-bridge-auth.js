'use strict';

const assert = require('assert');
const { canonical, resetBridgeNoncesForTests, verifyBridgeRequest } = require('./multi-user/bridge-auth');
const crypto = require('crypto');

const secret = 'a'.repeat(48);
const method = 'POST';
const path = '/api/companion/control';
const body = JSON.stringify({ action: 'chatbot_on' });
const timestamp = '1700000000000';
const scope = 'control:write';

function signed(nonce = 'node-test-nonce', suppliedBody = body, suppliedScope = scope) {
  const signature = crypto.createHmac('sha256', secret).update(canonical(method, path, timestamp, nonce, suppliedBody, suppliedScope), 'utf8').digest('hex');
  return { method, path, body: suppliedBody, timestamp, nonce, scope: suppliedScope, signature };
}

resetBridgeNoncesForTests();
assert.deepStrictEqual(verifyBridgeRequest(secret, signed(), 1700000001000), { ok: true, scope: 'control:write' });
assert.deepStrictEqual(verifyBridgeRequest(secret, signed(), 1700000001000), { ok: false, error: 'replayed_request' });
assert.deepStrictEqual(verifyBridgeRequest(secret, { ...signed('stale'), timestamp: '1700000000000' }, 1700000400000), { ok: false, error: 'stale_request' });
assert.deepStrictEqual(verifyBridgeRequest(secret, { ...signed('tampered'), body: JSON.stringify({ action: 'chatbot_off' }) }, 1700000001000), { ok: false, error: 'invalid_signature' });
assert.deepStrictEqual(verifyBridgeRequest(secret, { ...signed('scope'), scope: 'admin:write' }, 1700000001000), { ok: false, error: 'invalid_scope' });
console.log('PASS: signed bot bridge authentication rejects replay, stale, tampered, and invalid-scope requests.');
