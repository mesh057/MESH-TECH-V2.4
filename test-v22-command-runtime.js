'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createV22CommandRuntime, blockedCommands } = require('./multi-user/v22-command-runtime');

async function main() {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-v22-runtime-'));
  try {
    const runtime = await createV22CommandRuntime({ sessionDir, ownerNumber: '254700000001' });
    assert(runtime.commands.size >= 200, 'The migrated V2.2 catalog should load the full command engine.');
    assert(runtime.commands.has('ping'), 'A known V2.2 public command should be available.');
    assert(runtime.commands.has('menu'), 'The V2.2 menu should expose the migrated catalog.');
    for (const command of blockedCommands) assert(!runtime.commands.has(command), `${command} must stay unavailable on the shared host.`);
    console.log(`PASS: V2.2 runtime loaded ${runtime.commands.size} safe command entries for an isolated session.`);
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
