'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MultiUserSessionManager } = require('./session-manager');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-tech-multi-user-'));
const manager = new MultiUserSessionManager({ rootDir: root, botEntry: path.join(__dirname, '..', 'index.js') });

const first = manager.normalizePhoneNumber('0746844168');
const second = manager.normalizePhoneNumber('254700000002');
assert.notEqual(first, second);
assert.notEqual(manager.sessionDir(first), manager.sessionDir(second));
assert(manager.sessionDir(first).endsWith(path.join('auth_sessions', first)) || manager.sessionDir(first).endsWith(first));

const fakeA = { number: first, accessToken: 'a', status: 'starting', pid: 1, authDir: manager.sessionDir(first), child: { killed: true } };
const fakeB = { number: second, accessToken: 'b', status: 'starting', pid: 2, authDir: manager.sessionDir(second), child: { killed: true } };
manager.sessions.set(first, fakeA);
manager.sessions.set(second, fakeB);
assert.equal(manager.count(), 2);
assert.notEqual(manager.get(first).accessToken, manager.get(second).accessToken);
console.log('PASS: additive multi-user session isolation is distinct by normalized phone number.');
fs.rmSync(root, { recursive: true, force: true });
