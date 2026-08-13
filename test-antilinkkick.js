'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-antilinkkick-'));
process.env.MESH_ANTILINKKICK_STATE_DIR = stateDir;
const antilinkkick = require('./antilinkkick');

const groupJid = 'antilinkkick-test@g.us';
const senderJid = '254700000002@s.whatsapp.net';
const botJid = '254700000001@s.whatsapp.net';

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

  const enforced = await antilinkkick.checkAntilinkKick({
    conn,
    m: {
      key: { remoteJid: groupJid, participant: senderJid, id: 'link-message', fromMe: false },
      message: { conversation: 'Visit https://example.com' },
    },
    waitForWarning: async () => {},
  });
  assert.strictEqual(enforced, true, 'A non-admin link sender must be removed when the control is enabled.');
  assert.deepStrictEqual(removals, [{ jid: groupJid, participants: [senderJid], action: 'remove' }]);
  assert.strictEqual(sent[0].payload.delete.id, 'link-message');
  assert.match(sent[1].payload.text, /@254700000002, group links are not allowed/);
  assert.deepStrictEqual(sent[1].payload.mentions, [senderJid]);
  assert.match(sent[2].payload.text, /was removed/);

  const adminConn = {
    ...conn,
    async groupMetadata() {
      return { participants: [{ id: botJid, admin: 'admin' }, { id: senderJid, admin: 'admin' }] };
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
  assert.strictEqual(antilinkkick.getWarningTemplate(groupJid), '⚠️ {user}, links are not allowed in this group. You will be removed now.');
  console.log('PASS: Restored V2.4 anti-link-kick protects enabled groups while preserving group-admin safeguards.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
