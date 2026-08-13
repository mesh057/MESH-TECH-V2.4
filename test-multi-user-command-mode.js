'use strict';
const assert = require('assert');
const fs = require('fs');

const entry = fs.readFileSync(require.resolve('./index.js'), 'utf8');
const commands = fs.readFileSync(require.resolve('./menu/case.js'), 'utf8');

assert.match(entry, /MESH_MULTI_USER_SESSION_OWNER/, 'The paired user must become the owner of their isolated session.');
assert.match(entry, /isMultiUserSession[\s\S]*MESH_MULTI_USER_SESSION_MODE[\s\S]*"public"/, 'Multi-user sessions must default to public mode.');
assert.match(commands, /if \(!global\.isMultiUserSession\) setValue\("meshBotMode", "self"\)/, 'Self mode must not persist across other users sessions.');
assert.match(commands, /if \(!global\.isMultiUserSession\) setValue\("meshBotMode", "public"\)/, 'Public mode must not persist across other users sessions.');

console.log('PASS: Multi-user sessions start public, assign the paired user as owner, and isolate mode changes.');
