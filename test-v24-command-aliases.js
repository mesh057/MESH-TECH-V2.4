'use strict';

const assert = require('assert');

const menu = require('./media/menu');
const { handleCommand } = require('./menu/case');

function message(text) {
  return {
    key: { remoteJid: '254700000001@s.whatsapp.net', fromMe: true, id: `v24-${text}` },
    message: { conversation: text },
  };
}

async function main() {
  const sent = [];
  const relayed = [];
  const conn = {
    user: { id: '254700000001:1@s.whatsapp.net' },
    async sendMessage(jid, payload, options) {
      sent.push({ jid, payload, options });
      return { key: { id: `mock-${sent.length}` } };
    },
    async relayMessage(jid, payload, options) {
      relayed.push({ jid, payload, options });
    },
  };

  global.owner = '254700000001@s.whatsapp.net';
  global.mode = 'public';
  global.autostatus = false;

  await handleCommand(conn, message('.autoviewstatus on'));
  assert.strictEqual(global.autostatus, true, 'The autoviewstatus alias must toggle the original autostatus handler.');
  assert.match(sent.at(-1).payload.text, /ENABLED/);

  await handleCommand(conn, message('.autostatus off'));
  assert.strictEqual(global.autostatus, false, 'The canonical autostatus command must remain available.');
  assert.match(sent.at(-1).payload.text, /DISABLED/);

  await handleCommand(conn, message('.help'));
  assert.strictEqual(relayed.length, 1, 'The help alias must deliver the accurate V2.4 menu.');

  assert.match(menu.menu, /\.autoviewstatus on\|off/);
  assert.match(menu.menu, /only the restored handlers currently included/);
  assert.doesNotMatch(menu.menu, /222\+|TAYYAB|HELL-MD/);
  console.log('PASS: Lean V2.4 aliases resolve to restored handlers and the menu advertises only supported commands.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
