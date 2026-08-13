'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.MESH_MULTI_USER_SESSION_OWNER = '254700000001';
const { createV22CommandRuntime } = require('./multi-user/v22-command-runtime');

const commandDir = path.join(__dirname, 'v22-engine', 'commands');
const externalOrPrivileged = /axios|fetch\(|https?\.|yt-search|footballData|googleapis|play-dl|ffmpeg|sharp|sticker|groupMetadata|groupParticipants|groupSetting|profilePicture|updateProfile|blockStatus|process\.exit|child_process|exec\(|spawn\(|eval\(|downloadMedia|writeFile|unlink|rmSync|mkdirSync|readFileSync/i;
const excludedFiles = new Set(['builtins.js', 'commandControl.js', 'mode.js', 'public.js', 'self.js', 'restart.js', 'shell.js', 'eval.js']);

function flatten(loaded) {
  return Array.isArray(loaded) ? loaded : [loaded];
}

function withTimeout(promise, file) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${file} timed out`)), 2500)),
  ]);
}

async function main() {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-v22-smoke-'));
  const sent = [];
  const sock = {
    user: { id: '254700000001:1@s.whatsapp.net', name: 'MESH test owner' },
    async sendMessage(jid, payload, options) {
      sent.push({ jid, payload, options });
      return { key: { id: `mock-${sent.length}` } };
    },
    async sendPresenceUpdate() {},
    async readMessages() {},
  };
  const msg = {
    key: { remoteJid: '254700000001@s.whatsapp.net', fromMe: true, id: 'smoke-1' },
    message: { conversation: '.smoke' },
  };

  try {
    const runtime = await createV22CommandRuntime({ sessionDir, ownerNumber: '254700000001' });
    const failures = [];
    let exercised = 0;

    for (const file of fs.readdirSync(commandDir).filter((entry) => entry.endsWith('.js')).sort()) {
      if (excludedFiles.has(file)) continue;
      const source = fs.readFileSync(path.join(commandDir, file), 'utf8');
      if (externalOrPrivileged.test(source)) continue;
      const loaded = require(path.join(commandDir, file));
      for (const command of flatten(loaded)) {
        if (!command || typeof command.name !== 'string' || typeof command.execute !== 'function') continue;
        if (!runtime.commands.has(command.name)) continue;
        exercised += 1;
        try {
          await withTimeout(runtime.execute(command.name, sock, msg, []), file);
        } catch (error) {
          failures.push(`${file} (${command.name}): ${error.message || error}`);
        }
      }
    }

    assert(exercised >= 50, `Expected broad deterministic coverage, exercised only ${exercised} commands.`);
    assert.deepStrictEqual(failures, [], `Deterministic migrated commands failed:\n${failures.join('\n')}`);
    assert(sent.length > 0, 'Smoke commands should produce WhatsApp responses through the compatibility runtime.');
    console.log(`PASS: ${exercised} deterministic V2.2 command modules executed through the isolated multi-user runtime.`);
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
