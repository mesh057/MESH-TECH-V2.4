'use strict';

const axios = require('axios');

function trimUrl(value) { return String(value || '').trim().replace(/\/+$/, ''); }

function getHistoryConfig(env = process.env) {
  const baseUrl = trimUrl(env.MESH_HISTORY_RELAY_URL);
  const token = String(env.MESH_HISTORY_RELAY_TOKEN || '').trim();
  return { enabled: Boolean(baseUrl && token), baseUrl, token, timeoutMs: 12_000 };
}

function headers(config) { return { 'Content-Type': 'application/json', 'X-Mesh-History-Token': config.token }; }

async function recent(config, conversationId) {
  if (!config.enabled) return [];
  try {
    const response = await axios.get(`${config.baseUrl}/api/history-relay/recent`, { params: { conversationId }, headers: headers(config), timeout: config.timeoutMs, validateStatus: (status) => status >= 200 && status < 300 });
    return Array.isArray(response.data?.messages) ? response.data.messages.filter((item) => (item?.role === 'user' || item?.role === 'assistant') && typeof item.content === 'string') : [];
  } catch (error) { console.error(`[mesh-history] restore failed: ${error.message}`); return []; }
}

async function append(config, conversationId, messages) {
  if (!config.enabled || !messages.length) return false;
  try {
    await axios.post(`${config.baseUrl}/api/history-relay/append`, { conversationId, messages }, { headers: headers(config), timeout: config.timeoutMs, validateStatus: (status) => status >= 200 && status < 300 });
    return true;
  } catch (error) { console.error(`[mesh-history] save failed: ${error.message}`); return false; }
}

async function clear(config, conversationId) {
  if (!config.enabled) return false;
  try {
    await axios.post(`${config.baseUrl}/api/history-relay/clear`, { conversationId }, { headers: headers(config), timeout: config.timeoutMs, validateStatus: (status) => status >= 200 && status < 300 });
    return true;
  } catch (error) { console.error(`[mesh-history] clear failed: ${error.message}`); return false; }
}

module.exports = { getHistoryConfig, recent, append, clear };
