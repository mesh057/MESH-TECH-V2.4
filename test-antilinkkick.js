'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-antilinkkick-'));
process.env.MESH_ANTILINKKICK_STATE_DIR = stateDir;
process.env.MESH_PROTECTION_LOG_STATE_DIR = stateDir;
const antilinkkick = require('./antilinkkick');
const protectionLog = require('./protection-log');

const groupJid = 'antilinkkick-test@g.us';
const senderJid = '254700000002@s.whatsapp.net';
const botJid = '254700000001@s.whatsapp.net';
const adminJid = '254700000003@s.whatsapp.net';

async function main() {
  const replies = [];
  const sent = [];
  const removals = [];
  const conn = {
    user: { id: '254700000001:1@s.whatsapp.net' },
    async groupMetadata() {
      return {
        participants: [
          { id: botJid, admin: 'admin' },
          { id: adminJid, admin: 'admin' },
          { id: senderJid, admin: null },
        ],
      };
    },
    async sendMessage(jid, payload) {
      sent.push({ jid, payload });
    },
    async groupParticipantsUpdate(jid, participants, action) {
      removals.push({ jid, participants, action });
    },
  };

  await antilinkkick.configureAntilinkKick({
    m: { key: { remoteJid: groupJid } }, args: ['on'], reply: (text) => replies.push(text), jid: groupJid, isGroup: true,
  });
  assert.strictEqual(antilinkkick.isAntilinkKickEnabled(groupJid), true);
  assert.strictEqual(antilinkkick.getStrikeLimit(groupJid), 3, 'The default removal policy must be three warnings.');
  assert.match(replies.at(-1), /ENABLED/);

  await antilinkkick.configureAntilinkKick({
    m: { key: { remoteJid: groupJid } },
    args: ['warning', '🚫', '{user},', 'group', 'links', 'are', 'not', 'allowed.'],
    reply: (text) => replies.push(text),
    jid: groupJid,
    isGroup: true,
  });
  assert.strictEqual(antilinkkick.getWarningTemplate(groupJid), '🚫 {user}, group links are not allowed.');
  assert.match(replies.at(-1), /@user/);

  const firstStrike = await antilinkkick.checkAntilinkKick({
    conn,
    m: {
      key: { remoteJid: groupJid, participant: senderJid, id: 'link-message-one', fromMe: false },
      message: { conversation: 'Visit https://example.com' },
    },
    waitForWarning: async () => {},
  });
  assert.strictEqual(firstStrike, true, 'The first prohibited link must be handled.');
  assert.strictEqual(antilinkkick.getStrikeCount(groupJid, senderJid), 1);
  assert.deepStrictEqual(removals, [], 'A member must not be removed on the first warning.');
  assert.strictEqual(sent[0].payload.delete.id, 'link-message-one');
  assert.match(sent[1].payload.text, /@254700000002, group links are not allowed/);
  assert.match(sent[1].payload.text, /Strike: \*1\/3\*/);
  assert.deepStrictEqual(sent[1].payload.mentions, [senderJid]);

  await antilinkkick.checkAntilinkKick({
    conn,
    m: {
      key: { remoteJid: groupJid, participant: senderJid, id: 'link-message-two', fromMe: false },
      message: { conversation: 'https://example.com/two' },
    },
    waitForWarning: async () => {},
  });
  assert.strictEqual(antilinkkick.getStrikeCount(groupJid, senderJid), 2);
  assert.deepStrictEqual(removals, [], 'A member must not be removed before the final configured warning.');
  assert.match(sent[3].payload.text, /Strike: \*2\/3\*/);

  const thirdStrike = await antilinkkick.checkAntilinkKick({
    conn,
    m: {
      key: { remoteJid: groupJid, participant: senderJid, id: 'link-message-three', fromMe: false },
      message: { conversation: 'https://example.com/three' },
    },
    waitForWarning: async () => {},
  });
  assert.strictEqual(thirdStrike, true, 'The final configured warning must trigger removal.');
  assert.deepStrictEqual(removals, [{ jid: groupJid, participants: [senderJid], action: 'remove' }]);
  assert.strictEqual(antilinkkick.getStrikeCount(groupJid, senderJid), 0, 'A removed member must not retain strikes.');
  assert.match(sent[5].payload.text, /Strike: \*3\/3\*/);
  assert.match(sent[6].payload.text, /3-strike anti-link limit/);
  assert.match(sent[7].payload.text, /ANTI-LINK-KICK REMOVAL/);
  assert.deepStrictEqual(sent[7].payload.mentions, [adminJid], 'Only verified non-bot group admins must receive the incident log.');

  await antilinkkick.configureAntilinkKick({
    m: { key: { remoteJid: groupJid } }, args: ['strikes', '1'], reply: (text) => replies.push(text), jid: groupJid, isGroup: true,
  });
  protectionLog.setProtectionLoggingEnabled(groupJid, false);
  const sentBeforeDisabledLog = sent.length;
  await antilinkkick.checkAntilinkKick({
    conn,
    m: {
      key: { remoteJid: groupJid, participant: senderJid, id: 'link-message-no-log', fromMe: false },
      message: { conversation: 'https://example.com/no-log' },
    },
    waitForWarning: async () => {},
  });
  assert.strictEqual(sent.length, sentBeforeDisabledLog + 3, 'Disabling protection logging must suppress only the anti-link-kick admin incident message.');
  protectionLog.setProtectionLoggingEnabled(groupJid, true);

  await antilinkkick.configureAntilinkKick({
    m: { key: { remoteJid: groupJid } }, args: ['strikes', '2'], reply: (text) => replies.push(text), jid: groupJid, isGroup: true,
  });
  assert.strictEqual(antilinkkick.getStrikeLimit(groupJid), 2, 'An authorized administrator must be able to choose a group-specific limit.');
  assert.match(replies.at(-1), /set to \*2\*/);

  await antilinkkick.checkAntilinkKick({
    conn,
    m: {
      key: { remoteJid: groupJid, participant: senderJid, id: 'link-message-clear', fromMe: false },
      message: { conversation: 'https://example.com/clear' },
    },
    waitForWarning: async () => {},
  });
  assert.strictEqual(antilinkkick.getStrikeCount(groupJid, senderJid), 1);
  await antilinkkick.configureAntilinkKick({
    m: { key: { remoteJid: groupJid } }, args: ['strikes', 'clear'], reply: (text) => replies.push(text), jid: groupJid, isGroup: true,
  });
  assert.strictEqual(antilinkkick.getStrikeCount(groupJid, senderJid), 0, 'Group administrators must be able to clear saved strikes.');

  const adminConn = {
    ...conn,
    async groupMetadata() {
      return { participants: [{ id: botJid, admin: 'admin' }, { id: adminJid, admin: 'admin' }, { id: senderJid, admin: 'admin' }] };
    },
  };
  const preserved = await antilinkkick.checkAntilinkKick({
    conn: adminConn,
    m: {
      key: { remoteJid: groupJid, participant: senderJid, id: 'admin-link', fromMe: false },
      message: { conversation: 'https://example.com' },
    },
    waitForWarning: async () => {},
  });
  assert.strictEqual(preserved, false, 'Group admins must never be removed by automatic enforcement.');

  await antilinkkick.configureAntilinkKick({
    m: { key: { remoteJid: groupJid } }, args: ['off'], reply: (text) => replies.push(text), jid: groupJid, isGroup: true,
  });
  assert.strictEqual(antilinkkick.isAntilinkKickEnabled(groupJid), false);
  await antilinkkick.configureAntilinkKick({
    m: { key: { remoteJid: groupJid } }, args: ['warning', 'reset'], reply: (text) => replies.push(text), jid: groupJid, isGroup: true,
  });
  assert.strictEqual(antilinkkick.getWarningTemplate(groupJid), '⚠️ {user}, links are not allowed in this group.');
  console.log('PASS: Restored V2.4 anti-link-kick applies persistent warning strikes while preserving group-admin safeguards.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
