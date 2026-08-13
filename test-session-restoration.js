'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MultiUserSessionManager } = require('./multi-user/session-manager');

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-sessions-'));
const writeCreds = (number, registered) => {
  const dir = path.join(rootDir, number, 'auth_info');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'creds.json'), JSON.stringify({ registered }));
};

try {
  writeCreds('254700000001', true);
  writeCreds('254700000002', false);
  fs.mkdirSync(path.join(rootDir, 'not-a-number'), { recursive: true });
  const manager = new MultiUserSessionManager({ rootDir });
  assert.deepStrictEqual(manager.listRestorableSessions(), ['254700000001']);
  console.log('PASS: Multi-user startup restores only registered WhatsApp sessions from persistent storage.');
} finally {
  fs.rmSync(rootDir, { recursive: true, force: true });
}
