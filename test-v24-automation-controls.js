'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-v24-automation-'));
process.env.MESH_ANTIDELETE_STATE_DIR = stateDir;
process.env.MESH_AUTOREACT_STATE_DIR = stateDir;

const antidelete = require('./antidelete');
const { handleCommand } = require('./menu/case');
const autoreact = require('./autoreact');

function message(text, id = `message-${text}`, chatId = 'v24-test@g.us') {
  return {
    key: { remoteJid: chatId, fromMe: true, id },
    message: { conversation: text },
  };
}

async function main() {
  const sent = [];
  const conn = {
    user: { id: '254700000009:1@s.whatsapp.net' },
    async sendMessage(jid, payload, options) {
      sent.push({ jid, payload, options });
      return { key: { id: `mock-${sent.length}` } };
    },
  };

  global.owner = '254700000009@s.whatsapp.net';
  global.mode = 'public';
  antidelete.setBotId(conn);

  await handleCommand(conn, message('.antidelete on'));
  const chatId = 'v24-test@g.us';
  assert.strictEqual(antidelete.isAntideleteEnabled(chatId), true, 'Anti-delete must enable for the current chat.');

  const erased = {
    key: { remoteJid: chatId, participant: '254700000002@s.whatsapp.net', id: 'erased-message', fromMe: false },
    pushName: 'Tester',
    message: { conversation: 'Restore this message' },
  };
  antidelete.storeMessage(erased);
  await antidelete.handleMessageRevocation(conn, {
    key: { remoteJid: chatId, participant: '254700000002@s.whatsapp.net', id: 'revoke-event', fromMe: false },
    message: { protocolMessage: { type: 0, key: { id: 'erased-message' } } },
  });
  assert.strictEqual(sent.at(-1).jid, '254700000009@s.whatsapp.net',
    'Recovered group content must be delivered only to the linked owner’s private chat.');
  assert.match(sent.at(-1).payload.text, /Restore this message/);
  assert.match(sent.at(-1).payload.text, /Group chat/);

  await handleCommand(conn, message('.autoreactstatus on'));
  assert.strictEqual(autoreact.getStatusReactionState().enabled, true,
    'The autoreactstatus command must persist enabled status reactions.');

  await handleCommand(conn, message('.autoreactstatus emoji 💜'));
  assert.strictEqual(autoreact.getStatusReactionState().emoji, '💜',
    'The selected status reaction emoji must persist.');

  await handleCommand(conn, message('.autoreactstatus status'));
  assert.match(sent.at(-1).payload.text, /Enabled/);
  assert.match(sent.at(-1).payload.text, /💜/);

  await handleCommand(conn, message('.settings'));
  assert.match(sent.at(-1).payload.text, /MESH V2\.4 SETTINGS/);
  assert.match(sent.at(-1).payload.text, /Status emoji: 💜/);

  await handleCommand(conn, message('.antidelete off'));
  assert.strictEqual(antidelete.isAntideleteEnabled(chatId), false, 'Anti-delete must disable for the current chat.');

  console.log('PASS: Restored V2.4 anti-delete and autoreactstatus controls persist state and recover an enabled-chat deletion.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
