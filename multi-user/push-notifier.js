'use strict';

const axios = require('axios');
const { getValue, setValue, deleteKey } = require('../system/storage');

const PUSH_TOKEN_KEY = 'meshCompanionExpoPushToken';
const LAST_EVENT_KEY = 'meshCompanionLastPushEvent';
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

function isExpoPushToken(token) {
  return /^(Expo|Exponent)PushToken\[[^\]]{8,220}\]$/.test(String(token || '').trim());
}

function getPushToken() {
  const token = getValue(PUSH_TOKEN_KEY);
  return isExpoPushToken(token) ? token : null;
}

function registerPushToken(token) {
  const normalized = String(token || '').trim();
  if (!isExpoPushToken(normalized)) throw new Error('The device did not provide a valid Expo push token.');
  setValue(PUSH_TOKEN_KEY, normalized);
  return { enabled: true };
}

function clearPushToken() {
  deleteKey(PUSH_TOKEN_KEY);
}

function pushStatus() {
  return { enabled: Boolean(getPushToken()) };
}

async function notifyBotEvent({ event, title, body }) {
  const token = getPushToken();
  if (!token) return { sent: false, reason: 'no_registered_device' };

  const now = Date.now();
  const previous = getValue(LAST_EVENT_KEY) || {};
  if (previous.event === event && now - Number(previous.at || 0) < 90_000) {
    return { sent: false, reason: 'duplicate_event' };
  }

  try {
    const response = await axios.post(EXPO_PUSH_ENDPOINT, [{
      to: token,
      title: String(title || 'MESH AI bot status').slice(0, 120),
      body: String(body || '').slice(0, 500),
      sound: 'default',
      priority: 'high',
      channelId: 'mesh-bot-status',
      data: { url: '/controls', event: String(event || 'status') },
    }], {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      timeout: 15_000,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const ticket = Array.isArray(response.data?.data) ? response.data.data[0] : null;
    if (ticket?.status === 'error' && ['DeviceNotRegistered', 'InvalidCredentials'].includes(ticket.details?.error)) {
      clearPushToken();
      return { sent: false, reason: ticket.details.error };
    }
    setValue(LAST_EVENT_KEY, { event, at: now });
    return { sent: true };
  } catch (error) {
    console.error(`[mesh-push] could not send ${event}: ${error.message}`);
    return { sent: false, reason: 'delivery_error' };
  }
}

module.exports = { registerPushToken, clearPushToken, getPushToken, pushStatus, notifyBotEvent, isExpoPushToken };
