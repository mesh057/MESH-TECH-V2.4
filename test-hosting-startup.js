'use strict';
const assert = require('assert');
const fs = require('fs');
const source = fs.readFileSync(require.resolve('./index.js'), 'utf8');

assert.match(source, /MESH_PAIRING_PHONE_NUMBER/, 'The hosted pairing environment variable must be supported.');
assert.match(source, /process\.stdin\.isTTY/, 'Non-interactive hosts must be detected before asking for input.');
assert.doesNotMatch(source, /rl\.question/, 'The global readline prompt must not run on Railway.');

console.log('PASS: WhatsApp startup avoids interactive Railway prompts and supports environment-based pairing.');
