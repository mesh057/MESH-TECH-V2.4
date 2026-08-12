'use strict';

const assert = require('assert');
const axios = require('axios');
const history = require('./history-client');

const originalGet = axios.get;
const originalPost = axios.post;
const config = history.getHistoryConfig({ MESH_HISTORY_RELAY_URL: 'https://history.example/', MESH_HISTORY_RELAY_TOKEN: 'private-history-token' });

async function run() {
  try {
    assert.equal(config.enabled, true);
    assert.equal(history.getHistoryConfig({}).enabled, false);
    axios.get = async (url, options) => {
      assert.equal(url, 'https://history.example/api/history-relay/recent');
      assert.equal(options.headers['X-Mesh-History-Token'], 'private-history-token');
      assert.equal(options.params.conversationId, 'dm:254700000000');
      return { data: { messages: [{ role: 'user', content: 'Saved question' }, { role: 'assistant', content: 'Saved answer' }] } };
    };
    axios.post = async (url, body, options) => {
      assert.equal(options.headers['X-Mesh-History-Token'], 'private-history-token');
      assert.ok(url.endsWith('/api/history-relay/append') || url.endsWith('/api/history-relay/clear'));
      if (url.endsWith('/append')) assert.equal(body.messages[0].content, 'Saved question');
      return { data: { ok: true } };
    };
    assert.deepEqual(await history.recent(config, 'dm:254700000000'), [{ role: 'user', content: 'Saved question' }, { role: 'assistant', content: 'Saved answer' }]);
    assert.equal(await history.append(config, 'dm:254700000000', [{ role: 'user', content: 'Saved question' }]), true);
    assert.equal(await history.clear(config, 'dm:254700000000'), true);
    console.log('PASS: MESH AI history relay client safely restores, saves, and clears bounded context.');
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
}

run().catch((error) => { console.error(error); process.exit(1); });
