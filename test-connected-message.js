'use strict';
const assert = require('assert');
const { connectedCaption, ownJid, officialChannelUrl, officialGroupUrl } = require('./multi-user/connected-message');

assert.strictEqual(ownJid({ user: { id: '254700000001:17@s.whatsapp.net' } }), '254700000001@s.whatsapp.net');
const caption = connectedCaption({ ownerNumber: '254700000001', commandCount: 444 });
assert.match(caption, /444 loaded/);
assert.match(caption, new RegExp(officialGroupUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(caption, new RegExp(officialChannelUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(caption, /SESSION_ID|AUTH_INFO|TOKEN/i);

console.log('PASS: Connected message uses MESH branding links without exposing session credentials.');
