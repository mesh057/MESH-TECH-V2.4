'use strict';
const assert = require('assert');
const { connectedCaption, connectedMessageEnabled, ownJid, officialChannelUrl, officialGroupUrl, sendConnectedMessage } = require('./multi-user/connected-message');

assert.strictEqual(ownJid({ user: { id: '254700000001:17@s.whatsapp.net' } }), '254700000001@s.whatsapp.net');
const caption = connectedCaption({ ownerNumber: '254700000001', commandCount: 444 });
assert.match(caption, /444 loaded/);
assert.match(caption, new RegExp(officialGroupUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(caption, new RegExp(officialChannelUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(caption, /SESSION_ID|AUTH_INFO|TOKEN/i);

const messages = [];
sendConnectedMessage({
  user: { id: '254700000001:7@s.whatsapp.net' },
  sendMessage: async (jid, payload, options) => messages.push({ jid, payload, options }),
}, { ownerNumber: '254700000001', commandCount: 450 }).then(() => {
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].jid, '254700000001@s.whatsapp.net');
  assert(Buffer.isBuffer(messages[0].payload.image), 'The copied MESH logo should be attached to the connected message.');
  assert.match(messages[0].payload.caption, /450 loaded/);
  assert.deepStrictEqual(messages[0].options.mentions, ['254700000001@s.whatsapp.net']);
  assert.strictEqual(connectedMessageEnabled(), true);
  console.log('PASS: Connected message sends the MESH logo only to the linked user session.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

console.log('PASS: Connected message uses MESH branding links without exposing session credentials.');
