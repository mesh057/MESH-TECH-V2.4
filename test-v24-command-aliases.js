'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
  assert.strictEqual(relayed.length, 1, 'The help alias must deliver the V2.2-style V2.4 menu.');

  const groupMessage = {
    key: { remoteJid: 'v24-menu-test@g.us', fromMe: true, id: 'v24-autogreet' },
    message: { conversation: '.autogreet on' },
  };
  await handleCommand(conn, groupMessage);
  assert.strictEqual(global.autogreet['v24-menu-test@g.us'], true,
    'The listed auto-greet control must resolve through the V2.4 router in a group.');

  await handleCommand(conn, {
    key: { remoteJid: 'v24-menu-test@g.us', fromMe: true, id: 'v24-kick' },
    message: { conversation: '.kick' },
  });
  assert.match(sent.at(-1).payload.text, /reply karo jis user ko kick karna hai/i,
    'The listed kick control must resolve through the V2.4 router in a group.');

  assert.match(menu.menu, /╔═❖•⊰ \*𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗠𝗘𝗡𝗨\* ⊱•❖═╗/);
  assert.match(menu.menu, /╔═❖•⊰ 🪅 \*AUTOMATION MENU\* ⊱•❖═╗/);
  assert.match(menu.menu, /║➊ ⟿ \.autostatus on\|off/);
  assert.match(menu.menu, /\.autoviewstatus on\|off/);
  assert.match(menu.menu, /\.antideleteforward on\|off\|status/);
  assert.match(menu.menu, /\.autoreactstatus emoji 💜/);
  assert.match(menu.menu, /║➋ ⟿ \.autogreet on\|off/);
  assert.match(menu.menu, /\.antilink on\|off/);
  assert.match(menu.menu, /\.antilinkkick on\|off\|status/);
  for (const commandFile of ['kick.js', 'autogreet.js', 'antilink.js', 'antilinkkick.js']) {
    assert.ok(fs.existsSync(path.join(__dirname, commandFile)), `${commandFile} must back its menu entry.`);
  }
  assert.doesNotMatch(menu.menu, /222\+|HELL-MD/);
  console.log('PASS: V2.2 menu styling is retained while the drop-down lists only restored V2.4 commands.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
