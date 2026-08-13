'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.MESH_MULTI_USER_SESSION_OWNER = '254700000001';
process.env.MESH_COMMAND_TIMEOUT_MS = '1000';

const { createV22CommandRuntime } = require('./multi-user/v22-command-runtime');

async function main() {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-command-timeout-'));
  const sent = [];
  const sock = {
    async sendMessage(jid, payload, options) {
      sent.push({ jid, payload, options });
      return { key: { id: `mock-${sent.length}` } };
    },
  };
  const msg = { key: { remoteJid: '254700000001@s.whatsapp.net', fromMe: true, id: 'timeout-1' }, message: { conversation: '.timeoutfixture' } };

  try {
    const runtime = await createV22CommandRuntime({ sessionDir, ownerNumber: '254700000001' });
    runtime.commands.set('timeoutfixture', { name: 'timeoutfixture', execute: () => new Promise(() => {}) });
    const startedAt = Date.now();
    assert.deepStrictEqual(await runtime.execute('timeoutfixture', sock, msg, []), { handled: true });
    assert(Date.now() - startedAt < 2_500, 'The timeout guard must return rather than leaving the message handler stuck.');
    assert.match(sent.at(-1).payload.text, /could not complete right now/);
    console.log('PASS: Provider-stalled commands return a bounded compatibility reply instead of blocking the multi-user dispatcher.');
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
