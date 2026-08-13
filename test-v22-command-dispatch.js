'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.MESH_MULTI_USER_SESSION_OWNER = '254700000001';
const { createV22CommandRuntime } = require('./multi-user/v22-command-runtime');

async function main() {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-v22-dispatch-'));
  const sent = [];
  const sock = {
    user: { id: '254700000001:1@s.whatsapp.net' },
    async sendMessage(jid, payload, options) {
      sent.push({ jid, payload, options });
      return { key: { id: `mock-${sent.length}` } };
    },
  };
  const msg = {
    key: { remoteJid: '254700000001@s.whatsapp.net', fromMe: true, id: 'message-1' },
    message: { conversation: '.calc 2 + 2' },
  };

  try {
    const runtime = await createV22CommandRuntime({ sessionDir, ownerNumber: '254700000001' });
    assert.deepStrictEqual(await runtime.execute('missing-command', sock, msg, []), { handled: false });

    assert.deepStrictEqual(await runtime.execute('calc', sock, msg, ['2', '+', '2']), { handled: true });
    assert.match(sent.at(-1).payload.text, /2 \+ 2 = 4/);

    assert.deepStrictEqual(await runtime.execute('autoreact', sock, msg, ['on']), { handled: true });
    assert.strictEqual(runtime.resources.settings.get('autoreact'), true);

    assert.deepStrictEqual(await runtime.execute('menu', sock, msg, []), { handled: true });
    assert(sent.length >= 4, 'The full menu must send a selectable list and readable fallback catalog.');
    assert.match(sent.find((entry) => /𝗥𝗔𝗠: 128 GB/.test(entry.payload.text || ''))?.payload.text || '', /𝗥𝗔𝗠: 128 GB/);

    assert.deepStrictEqual(await runtime.execute('help', sock, msg, []), { handled: true });
    assert.match(sent.at(-1).payload.text, /Available Commands/);

    assert.deepStrictEqual(await runtime.execute('commandstatus', sock, msg, []), { handled: true });
    assert.match(sent.at(-1).payload.text, /Command status/);

    runtime.commands.set('brokenfixture', { name: 'brokenfixture', execute: async () => { throw new Error('fixture failure'); } });
    assert.deepStrictEqual(await runtime.execute('brokenfixture', sock, msg, []), { handled: true });
    assert.match(sent.at(-1).payload.text, /could not complete right now/);

    assert.deepStrictEqual(await runtime.execute('alive', sock, msg, []), { handled: true });
    assert.match(sent.at(-2).payload.text, /I'M ALIVE MATE/);
    assert(Buffer.isBuffer(sent.at(-1).payload.audio), 'The alive command should follow its text with the bundled audio clip.');
    console.log('PASS: V2.2 runtime dispatches public, owner, and menu commands inside an isolated session.');
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
