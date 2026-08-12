'use strict';

const assert = require('assert');
const { getValue, setValue, deleteKey } = require('./system/storage');
const { clearPushToken, getPushToken, isExpoPushToken, pushStatus, registerPushToken } = require('./multi-user/push-notifier');

const key = 'meshCompanionExpoPushToken';
const original = getValue(key);

try {
  assert.equal(isExpoPushToken('ExpoPushToken[owner-device-token]'), true);
  assert.equal(isExpoPushToken('invalid-token'), false);
  assert.throws(() => registerPushToken('invalid-token'), /valid Expo push token/);
  registerPushToken('ExpoPushToken[owner-device-token]');
  assert.equal(getPushToken(), 'ExpoPushToken[owner-device-token]');
  assert.equal(pushStatus().enabled, true);
  clearPushToken();
  assert.equal(pushStatus().enabled, false);
  console.log('PASS: MESH AI owner push-token validation and status handling are working.');
} finally {
  if (original === undefined) deleteKey(key);
  else setValue(key, original);
}
