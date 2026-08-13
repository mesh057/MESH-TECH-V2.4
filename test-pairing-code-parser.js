'use strict';
const assert = require('assert');
const { extractPairingCode, extractPairingError } = require('./multi-user/session-manager');

assert.strictEqual(extractPairingCode('Go to WhatsApp → Linked Devices → Link with code.'), null);
assert.strictEqual(extractPairingCode('PAIRING_CODE 1234-ABCD'), '1234-ABCD');
assert.strictEqual(extractPairingCode('noise\nPAIRING_CODE 12345678\nmore noise'), '12345678');
assert.strictEqual(extractPairingError('PAIRING_ERROR WhatsApp temporarily unavailable'), 'WhatsApp temporarily unavailable');
assert.strictEqual(extractPairingError('normal log output only'), null);

console.log('PASS: Multi-user pairing captures only explicit WhatsApp pairing-code markers.');
