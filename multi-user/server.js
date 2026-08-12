'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { MultiUserSessionManager } = require('./session-manager');

const manager = new MultiUserSessionManager();
const port = Number(process.env.MULTI_USER_PORT || process.env.PORT || 3000);
const rate = new Map();

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function allowed(ip) {
  const now = Date.now();
  const item = rate.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > item.reset) { item.count = 0; item.reset = now + 60_000; }
  item.count += 1;
  rate.set(ip, item);
  return item.count <= 10;
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (raw.length > 32_000) throw new Error('Request body is too large.');
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const ip = req.socket.remoteAddress || 'unknown';
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/pairing.html')) {
      const page = fs.readFileSync(path.join(__dirname, 'pairing.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(page);
    }
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, bot: 'MESH TECH MD', multiUser: true, active: manager.count() });
    if (req.method === 'GET' && url.pathname === '/api/status') {
      const active = manager.list();
      return json(res, 200, { ok: true, multiUser: true, active, botStatus: active.length ? 'initialized' : 'waiting', totalActive: active.length, registered: active.some(item => item.status === 'running') });
    }
    if (req.method === 'POST' && url.pathname === '/api/request-pairing') {
      if (!allowed(ip)) return json(res, 429, { success: false, error: 'Too many requests. Try again later.' });
      const data = await body(req);
      const session = await manager.start(data.phoneNumber);
      return json(res, 200, { success: true, message: 'Session started. Poll /api/pairing-code for the code.', phoneNumber: session.number, accessToken: session.accessToken });
    }
    if (req.method === 'GET' && url.pathname === '/api/pairing-code') {
      const number = url.searchParams.get('phoneNumber');
      const token = url.searchParams.get('accessToken');
      const session = manager.get(number);
      if (!session || session.accessToken !== token) return json(res, 403, { success: false, error: 'Invalid or expired session token.' });
      return json(res, 200, { success: true, status: session.status, code: session.code, phoneNumber: session.number, pid: session.pid });
    }
    if (req.method === 'POST' && url.pathname === '/api/stop') {
      const data = await body(req);
      const session = manager.get(data.phoneNumber);
      if (!session || session.accessToken !== data.accessToken) return json(res, 403, { success: false, error: 'Invalid session token.' });
      manager.stop(data.phoneNumber);
      return json(res, 200, { success: true, message: 'User session stopped.' });
    }
    json(res, 404, { success: false, error: 'Not found.' });
  } catch (error) {
    json(res, 400, { success: false, error: error.message });
  }
});

if (require.main === module) {
  server.listen(port, '0.0.0.0', () => console.log(`[mesh-multi-user] MESH TECH MD pairing server listening on ${port}`));
}

module.exports = { server, manager };
