'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-command-repairs-'));
process.env.MESH_ANTILINKKICK_STATE_DIR = stateDir;
process.env.MESH_ANTIBUG_STATE_DIR = stateDir;

const { handleCommand } = require('./menu/case');
const antiBug = require('./antibug');

const groupJid = 'repair-test@g.us';
const botJid = '254700000001@s.whatsapp.net';
const memberJid = '254700000002@s.whatsapp.net';
const adminJid = '254700000003@s.whatsapp.net';

async function main() {
  const sent = [];
  const conn = {
    user: { id: '254700000001:1@s.whatsapp.net' },
    async sendMessage(jid, payload, options) {
      sent.push({ jid, payload, options });
      return { key: { id: `repair-${sent.length}` } };
    },
    async groupMetadata() {
      return {
        participants: [
          { id: botJid, admin: 'admin' },
          { id: adminJid, admin: 'admin' },
          { id: memberJid, admin: null },
        ],
      };
    },
  };

  global.owner = botJid;
  global.mode = 'public';

  await handleCommand(conn, {
    key: { remoteJid: botJid, fromMe: true, id: 'repo-command' },
    message: { conversation: '.repo' },
  });
  assert.match(sent.at(-1).payload.text, /github\.com\/mesh057\/MESH-TECH-V2\.4/);

  await handleCommand(conn, {
    key: { remoteJid: groupJid, fromMe: true, id: 'legacy-antilinkick' },
    message: { conversation: '.antilinkick on' },
  });
  assert.match(sent.at(-1).payload.text, /Anti-link kick is now \*ENABLED/);

  await handleCommand(conn, {
    key: { remoteJid: groupJid, fromMe: true, id: 'antibug-on' },
    message: { conversation: '.antibug on' },
  });
  assert.strictEqual(antiBug.isAntiBugEnabled(groupJid), true);
  assert.match(sent.at(-1).payload.text, /Anti-bug protection is now \*ENABLED/);

  const normalMessage = {
    key: { remoteJid: groupJid, participant: memberJid, fromMe: false, id: 'normal-message' },
    message: { conversation: 'Normal group message' },
  };
  assert.strictEqual(await antiBug.antibugHandler({ conn, m: normalMessage }), false, 'Normal messages must not be deleted.');

  const suspiciousMessage = {
    key: { remoteJid: groupJid, participant: memberJid, fromMe: false, id: 'suspicious-message' },
    message: { conversation: 'x'.repeat(5001) },
  };
  assert.strictEqual(await antiBug.antibugHandler({ conn, m: suspiciousMessage }), true, 'Suspicious oversized messages must be deleted.');
  assert.strictEqual(sent.at(-2).payload.delete.id, 'suspicious-message');
  assert.match(sent.at(-1).payload.text, /ANTI-BUG MESSAGE REMOVAL/);
  assert.deepStrictEqual(sent.at(-1).payload.mentions, [adminJid], 'Only verified non-bot group admins must receive the anti-bug incident log.');

  const adminConn = {
    ...conn,
    async groupMetadata() {
      return {
        participants: [
          { id: botJid, admin: 'admin' },
          { id: adminJid, admin: 'admin' },
          { id: memberJid, admin: 'admin' },
        ],
      };
    },
  };
  assert.strictEqual(await antiBug.antibugHandler({ conn: adminConn, m: suspiciousMessage }), false, 'Group-admin messages must be preserved.');
  console.log('PASS: Repaired repo, legacy anti-link-kick, and anti-bug commands route safely and enforce group-admin safeguards.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
