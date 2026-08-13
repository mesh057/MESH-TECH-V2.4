'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.MESH_MULTI_USER_SESSION_OWNER = '254700000001';

const { createV22CommandRuntime } = require('./multi-user/v22-command-runtime');

async function run() {
  const audioPath = path.join(__dirname, 'v22-engine', 'assets', 'alive.m4a');
  assert(fs.existsSync(audioPath), 'The embedded alive audio file must be included in the deployment.');
  assert(fs.statSync(audioPath).size > 0, 'The embedded alive audio file must not be empty.');

  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-alive-audio-'));
  const sent = [];
  const sock = {
    user: { id: '254700000001:1@s.whatsapp.net' },
    sendMessage: async (jid, payload, options) => {
      sent.push({ jid, payload, options });
      return { key: { id: String(sent.length) } };
    },
  };
  const msg = {
    key: { remoteJid: '254700000001@s.whatsapp.net', fromMe: true },
    message: { conversation: '.alive' },
  };

  try {
    const runtime = await createV22CommandRuntime({ sessionDir, ownerNumber: '254700000001' });
    const result = await runtime.execute('alive', sock, msg, []);
    assert.deepStrictEqual(result, { handled: true });
    assert.strictEqual(sent.length, 2, 'The alive command must send a text status followed by audio.');
    assert.match(sent[0].payload.text, /I'M ALIVE MATE/i);
    assert(Buffer.isBuffer(sent[1].payload.audio), 'The second alive payload must contain the embedded audio buffer.');
    assert.strictEqual(sent[1].payload.mimetype, 'audio/mp4');
    assert.strictEqual(sent[1].payload.ptt, false);
    console.log('PASS: The alive command sends its status text and bundled M4A audio in an isolated multi-user session.');
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
