'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.MESH_MULTI_USER_SESSION_OWNER = '254700000001';
const { createV22CommandRuntime } = require('./multi-user/v22-command-runtime');
const { handleCommand } = require('./menu/case');

function message(text) {
  return {
    key: { remoteJid: '254700000001@s.whatsapp.net', fromMe: true, id: `message-${text}` },
    message: { conversation: text },
  };
}

async function main() {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-v22-handler-'));
  const sent = [];
  const conn = {
    user: { id: '254700000001:1@s.whatsapp.net' },
    async sendMessage(jid, payload, options) {
      sent.push({ jid, payload, options });
      return { key: { id: `mock-${sent.length}` } };
    },
    async relayMessage() {
      throw new Error('The V2.2 catalog should handle .menu before the old fallback menu.');
    },
  };

  try {
    global.owner = '254700000001@s.whatsapp.net';
    global.mode = 'public';
    global.isMultiUserSession = true;
    global.v22CommandRuntime = await createV22CommandRuntime({ sessionDir, ownerNumber: '254700000001' });

    await handleCommand(conn, message('.calc 6 * 7'));
    assert.match(sent.at(-1).payload.text, /6 \* 7 = 42/);

    await handleCommand(conn, message('.menu'));
    assert(sent.some((entry) => /COMMAND DIRECTORY|COMMANDS LOADED/.test(entry.payload.title || entry.payload.text || '')),
      'The full V2.2 menu should be delivered by the live V2.4 dispatcher.');

    const sentBeforeRestart = sent.length;
    await handleCommand(conn, message('.restart'));
    assert.strictEqual(sent.length, sentBeforeRestart + 1, 'Blocked restart must fall back to a harmless response.');
    assert(sent.at(-1).payload.text.includes('ᴜɴᴋɴᴏᴡɴ'), 'Blocked restart must return the harmless unknown-command reply.');

    console.log('PASS: V2.4 dispatcher routes the V2.2 catalog safely before legacy fallbacks.');
  } finally {
    delete global.v22CommandRuntime;
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
