'use strict';

const assert = require('assert');
const { getValue, setValue, deleteKey } = require('./system/storage');
const { applyCompanionControl, getCompanionStatus, titleFor, validImage } = require('./multi-user/companion-service');

const keys = ['meshBotMode', 'meshAiAutoReplyEnabled', 'meshAiServiceEnabled'];
const original = Object.fromEntries(keys.map((key) => [key, getValue(key)]));

function restore() {
  for (const key of keys) {
    if (original[key] === undefined) deleteKey(key);
    else setValue(key, original[key]);
  }
}

try {
  assert.equal(titleFor('  Build an Android companion for MESH AI  '), 'Build an Android companion for MESH AI');
  assert.equal(validImage({ mimeType: 'image/gif', base64: 'abcd' }), null);
  assert.equal(validImage({ mimeType: 'image/jpeg', base64: 'aGVsbG8=' }).mimeType, 'image/jpeg');

  let status = applyCompanionControl('bot_public');
  assert.equal(status.mode, 'public');
  status = applyCompanionControl('chatbot_on');
  assert.equal(status.chatbotEnabled, true);
  status = applyCompanionControl('mesh_ai_off');
  assert.equal(status.meshAiEnabled, false);
  status = applyCompanionControl('mesh_ai_on');
  assert.equal(status.meshAiEnabled, true);
  status = applyCompanionControl('chatbot_off');
  assert.equal(status.chatbotEnabled, false);
  status = applyCompanionControl('bot_self');
  assert.equal(status.mode, 'self');
  assert.equal(getCompanionStatus().ok, true);

  assert.throws(() => applyCompanionControl('unknown_action'), /Unsupported control action/);
  console.log('PASS: MESH AI companion status, owner controls, and image validation are working.');
} finally {
  restore();
}
