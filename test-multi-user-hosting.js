'use strict';
const assert = require('assert');
const fs = require('fs');

const manifest = JSON.parse(fs.readFileSync(require.resolve('./package.json'), 'utf8'));
const manager = fs.readFileSync(require.resolve('./multi-user/session-manager.js'), 'utf8');

assert.strictEqual(manifest.scripts.start, 'node multi-user/server.js', 'Railway must start the multi-user pairing server.');
assert.match(manager, /MESH_PAIRING_PHONE_NUMBER:\s*normalized/, 'Each isolated session must receive its own pairing number.');
assert.match(manager, /MESH_MULTI_USER_SESSION_OWNER:\s*normalized/, 'Each isolated session must treat its paired WhatsApp number as its owner.');
assert.match(manager, /MESH_MULTI_USER_SESSION_MODE:\s*'public'/, 'New multi-user sessions must start in public mode.');
assert.match(manager, /stdio:\s*\['ignore', 'pipe', 'pipe'\]/, 'Hosted child sessions must not rely on interactive stdin.');
assert.doesNotMatch(manager, /child\.stdin\.write/, 'User pairing must not be passed through a terminal prompt.');

console.log('PASS: Railway starts the multi-user pairing service and launches each user session without interactive input.');
