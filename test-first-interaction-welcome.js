'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.MESH_MULTI_USER_SESSION_OWNER = '254700000001';

const { createV22CommandRuntime } = require('./multi-user/v22-command-runtime');
const { welcomeFirstInteraction } = require('./multi-user/first-interaction-welcome');

function directMessage(text, sender = '254711111111@s.whatsapp.net') {
  return {
    key: { remoteJid: sender, participant: sender, fromMe: false, id: `message-${text || 'media'}` },
    message: text ? { conversation: text } : { imageMessage: { mimetype: 'image/jpeg' } },
  };
}

async function main() {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-first-interaction-'));
  const sent = [];
  const sock = {
    user: { id: '254700000001:1@s.whatsapp.net' },
    async sendMessage(jid, payload, options) {
      sent.push({ jid, payload, options });
      return { key: { id: `mock-${sent.length}` } };
    },
  };

  try {
    const runtime = await createV22CommandRuntime({ sessionDir, ownerNumber: '254700000001' });
    const first = await welcomeFirstInteraction({ runtime, sock, msg: directMessage('Hello MESH') });
    const firstTexts = sent.map((entry) => entry.payload.text || '').join('\n');

    assert.deepStrictEqual(first, { welcomed: true, helpSent: true });
    assert.match(firstTexts, /Welcome to MESH TECH MD/);
    assert.match(firstTexts, /Available Commands/);
    assert.match(firstTexts, /\.ping — Shows bot response speed\./);

    const afterFirst = sent.length;
    assert.deepStrictEqual(
      await welcomeFirstInteraction({ runtime, sock, msg: directMessage('Another message') }),
      { welcomed: false, reason: 'already-welcomed' },
    );
    assert.strictEqual(sent.length, afterFirst, 'A contact must not receive the welcome guide twice.');

    const restoredRuntime = await createV22CommandRuntime({ sessionDir, ownerNumber: '254700000001' });
    assert.deepStrictEqual(
      await welcomeFirstInteraction({ runtime: restoredRuntime, sock, msg: directMessage('After restart') }),
      { welcomed: false, reason: 'already-welcomed' },
    );

    const beforeHelpRequest = sent.length;
    const firstHelp = await welcomeFirstInteraction({
      runtime,
      sock,
      msg: directMessage('.help', '254722222222@s.whatsapp.net'),
    });
    assert.deepStrictEqual(firstHelp, { welcomed: true, helpSent: false });
    assert.strictEqual(sent.length, beforeHelpRequest + 1, 'An initial .help should add only a welcome because normal command routing supplies the guide.');
    assert.match(sent.at(-1).payload.text, /Welcome to MESH TECH MD/);

    const beforeGroup = sent.length;
    const groupResult = await welcomeFirstInteraction({
      runtime,
      sock,
      msg: {
        key: { remoteJid: '123456789@g.us', participant: '254733333333@s.whatsapp.net', fromMe: false, id: 'group-message' },
        message: { conversation: 'hello everyone' },
      },
    });
    assert.deepStrictEqual(groupResult, { welcomed: false, reason: 'not-eligible' });
    assert.strictEqual(sent.length, beforeGroup, 'Group messages must not trigger direct-message onboarding.');

    console.log('PASS: First direct interaction receives one persisted welcome and dynamic help guide without duplicate delivery.');
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
