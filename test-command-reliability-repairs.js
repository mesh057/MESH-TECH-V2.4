'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.MESH_MULTI_USER_SESSION_OWNER = '254700000001';

const { createV22CommandRuntime } = require('./multi-user/v22-command-runtime');
const { formatStandings } = require('./v22-engine/utils/footballData');
const { handleCommand } = require('./menu/case');

function message(text) {
  return {
    key: { remoteJid: '254700000001@s.whatsapp.net', fromMe: true, id: `repair-${text}` },
    message: { conversation: text },
  };
}

async function main() {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-reliability-repairs-'));
  const sent = [];
  const profileUpdates = [];
  const sock = {
    user: { id: '254700000001:1@s.whatsapp.net' },
    async sendMessage(jid, payload, options) {
      sent.push({ jid, payload, options });
      return { key: { id: `mock-${sent.length}` } };
    },
    async updateProfileStatus(value) { profileUpdates.push(value); },
    async updateProfileName() {},
    async updateProfilePicture() {},
  };

  try {
    const runtime = await createV22CommandRuntime({ sessionDir, ownerNumber: '254700000001' });
    assert(!runtime.commands.has('backup'), 'Host backup must not be exposed in isolated sessions.');
    assert(!runtime.commands.has('updatenow'), 'Runtime self-updates must not be exposed in isolated sessions.');
    assert(!runtime.commands.has('shutdown'), 'A paired user must not terminate the Railway bot process with a command.');

    await runtime.execute('checkme', sock, message('.checkme'), []);
    assert.match(sent.at(-1).payload.text, /BOT OWNER/);

    await runtime.execute('intro', sock, message('.intro'), []);
    assert.match(sent.at(-1).payload.text, /MESH TECH MD/);

    await runtime.execute('setbio', sock, message('.setbio Ready'), ['Ready']);
    assert.deepStrictEqual(profileUpdates, ['Ready']);

    global.owner = '254700000001@s.whatsapp.net';
    global.mode = 'public';
    global.isMultiUserSession = true;
    global.v22CommandRuntime = runtime;
    await handleCommand(sock, message('.gemini explain arrays'));
    assert.match(sent.at(-1).payload.text, /MESH AI is not configured yet|MESH AI could not reach|MESH AI/,
      'Legacy AI aliases must route through the maintained MESH AI handler rather than the dead shared proxy.');

    await handleCommand(sock, message('.play'));
    assert.match(sent.at(-1).payload.text, /Provide a song name or YouTube link/,
      'Legacy audio aliases must use the maintained play2 command path rather than the unavailable shared proxy.');

    await handleCommand(sock, message('.eplscorers'));
    assert.match(sent.at(-1).payload.text, /temporarily disabled/,
      'Commands with no maintained data source must fail transparently instead of calling a confirmed-dead provider.');

    const table = formatStandings({
      name: 'English Premier League',
      children: [{
        standings: {
          entries: [{
            team: { shortDisplayName: 'Example FC' },
            stats: [
              { name: 'rank', displayValue: '1' },
              { name: 'gamesPlayed', displayValue: '10' },
              { name: 'pointDifferential', displayValue: '12' },
              { name: 'points', displayValue: '25' },
            ],
          }],
        },
      }],
    }, 'Premier League');
    assert.match(table, /Example/);
    assert.match(table, /\+12/);
    assert.match(table, /25/);

    const indexSource = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    assert.match(indexSource, /for \(const msg of messages \|\| \[\]\)/,
      'The live Baileys dispatcher must process every message in an upsert batch.');

    console.log('PASS: Reliability repairs protect host-only commands, fix owner utilities, route stale AI aliases to MESH AI, and support batch dispatch plus standings formatting.');
  } finally {
    delete global.v22CommandRuntime;
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
