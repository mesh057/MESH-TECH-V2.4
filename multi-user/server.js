'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { MultiUserSessionManager } = require('./session-manager');
const { askCompanion, clearCompanionHistory, getCompanionStatus, applyCompanionControl } = require('./companion-service');
const { registerPushToken, pushStatus } = require('./push-notifier');
const { verifyBridgeRequest } = require('./bridge-auth');

const manager = new MultiUserSessionManager();
const port = Number(process.env.MULTI_USER_PORT || process.env.PORT || 3000);
const rate = new Map();

function companionAuthorized(req) {
  const configuredToken = String(process.env.MESH_COMPANION_CONTROL_TOKEN || '').trim();
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return Boolean(configuredToken) && supplied.length === configuredToken.length && require('crypto').timingSafeEqual(Buffer.from(supplied), Buffer.from(configuredToken));
}

function signedCompanionAuthorized(req, rawBody) {
  const secret = String(process.env.MESH_COMPANION_CONTROL_TOKEN || '').trim();
  return verifyBridgeRequest(secret, {
    method: req.method,
    path: new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname,
    body: rawBody || '',
    scope: String(req.headers['x-mesh-scope'] || ''),
    timestamp: String(req.headers['x-mesh-timestamp'] || ''),
    nonce: String(req.headers['x-mesh-nonce'] || ''),
    signature: String(req.headers['x-mesh-signature'] || ''),
  });
}

function uptimeRegistrationProof() {
  const secret = String(process.env.MESH_UPTIME_RELAY_SECRET || '').trim();
  if (!secret) throw new Error('MESH_UPTIME_RELAY_SECRET must be configured for independent uptime alerts.');
  return require('crypto').createHmac('sha256', secret).update('mesh-ai-uptime-owner-registration-v1').digest('hex');
}

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

async function readRawBody(req, maxLength = 32_000) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (raw.length > maxLength) throw new Error('Request body is too large.');
  return raw;
}

async function body(req, maxLength = 32_000) {
  const raw = await readRawBody(req, maxLength);
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const ip = req.socket.remoteAddress || 'unknown';
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard' || url.pathname === '/dashboard.html')) {
      const page = fs.readFileSync(path.join(__dirname, 'dashboard.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(page);
    }
    if (req.method === 'GET' && url.pathname === '/pairing.html') {
      const page = fs.readFileSync(path.join(__dirname, 'pairing.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(page);
    }
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, bot: 'MESH TECH MD', multiUser: true, active: manager.count() });
    if (url.pathname.startsWith('/api/companion/')) {
      const signedRequest = Boolean(req.headers['x-mesh-signature']);
      let parsedBody = {};
      let rawBody = '';
      if (signedRequest && req.method !== 'GET') {
        rawBody = await readRawBody(req);
        parsedBody = rawBody ? JSON.parse(rawBody) : {};
      }
      const signed = signedRequest ? signedCompanionAuthorized(req, rawBody) : null;
      if (signed?.ok) {
        if (signed.scope !== (req.method === 'GET' ? 'status:read' : 'control:write')) return json(res, 403, { ok: false, error: 'Insufficient bridge scope.' });
      } else if (!companionAuthorized(req)) {
        return json(res, 401, { ok: false, error: signed?.error || 'A valid owner control token is required.' });
      }
      if (req.method === 'GET' && url.pathname === '/api/companion/status') return json(res, 200, getCompanionStatus());
      if (req.method === 'POST' && url.pathname === '/api/companion/control') {
        const data = signedRequest ? parsedBody : await body(req);
        return json(res, 200, applyCompanionControl(String(data.action || '')));
      }
      if (req.method === 'POST' && url.pathname === '/api/companion/push-token') {
        const data = signedRequest ? parsedBody : await body(req);
        return json(res, 200, { ok: true, ...registerPushToken(data.token) });
      }
      if (req.method === 'GET' && url.pathname === '/api/companion/notifications') {
        return json(res, 200, { ok: true, ...pushStatus() });
      }
      if (req.method === 'POST' && url.pathname === '/api/companion/uptime-registration') {
        return json(res, 200, { ok: true, registrationProof: uptimeRegistrationProof() });
      }
      if (req.method === 'POST' && url.pathname === '/api/companion/history/clear') {
        const data = await body(req);
        await clearCompanionHistory(String(data.conversationId || 'owner-mobile-companion'));
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/companion/chat') {
        const data = await body(req, 4_500_000);
        const result = await askCompanion({ message: data.message, mode: data.mode, conversationId: data.conversationId, image: data.image });
        return json(res, 200, { ok: true, ...result });
      }
      return json(res, 404, { ok: false, error: 'Companion endpoint not found.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      const active = manager.list();
      return json(res, 200, { ok: true, multiUser: true, active, botStatus: active.length ? 'initialized' : 'waiting', totalActive: active.length, registered: active.some(item => item.status === 'running') });
    }
    if (req.method === 'POST' && url.pathname === '/api/request-pairing') {
      if (!allowed(ip)) return json(res, 429, { success: false, error: 'Too many requests. Try again later.' });
      const data = await body(req);
      if (!manager.hasSessionCapacity(data.phoneNumber)) {
        return json(res, 429, { success: false, error: `Maximum active sessions reached (${manager.maxInstances}).` });
      }
      const session = await manager.start(data.phoneNumber, data.useQr === true);
      return json(res, 200, { success: true, message: 'Session started. Poll /api/pairing-code for the code.', phoneNumber: session.number, accessToken: session.accessToken });
    }
    if (req.method === 'POST' && url.pathname === '/api/restore-session') {
      if (!allowed(ip)) return json(res, 429, { success: false, error: 'Too many requests. Try again later.' });
      const data = await body(req);
      const phoneNumber = String(data.phoneNumber || '').replace(/\D/g, '');
      const sessionIdBase64 = String(data.sessionId || '').trim();
      const ownerNumber = String(data.ownerNumber || phoneNumber).trim();

      if (!phoneNumber || !sessionIdBase64) {
        return json(res, 400, { success: false, error: 'Phone number and session ID are required.' });
      }
      if (!manager.hasSessionCapacity(phoneNumber)) {
        return json(res, 429, { success: false, error: `Maximum active sessions reached (${manager.maxInstances}).` });
      }

      const authDir = path.join(manager.sessionDir(phoneNumber), 'auth_info');
      fs.mkdirSync(authDir, { recursive: true });

      // Clean base64 if prefixed or raw
      let rawJson = sessionIdBase64;
      if (!sessionIdBase64.startsWith('{')) {
        try {
          // If it has a prefix like MESH_TECH_ remove it or decode base64
          const cleanB64 = sessionIdBase64.replace(/^MESH_TECH_/, '');
          rawJson = Buffer.from(cleanB64, 'base64').toString('utf8');
        } catch (e) {
          // fallback if it's plain text json or direct zip/multi-file
          rawJson = sessionIdBase64;
        }
      }

      try {
        const parsed = JSON.parse(rawJson);
        // If it's a map or multi-file creds object
        for (const [fileName, content] of Object.entries(parsed)) {
          fs.writeFileSync(path.join(authDir, fileName), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
        }
      } catch (e) {
        // If it's a single creds.json content
        fs.writeFileSync(path.join(authDir, 'creds.json'), rawJson);
      }

      // If instance exists, we must stop it first to ensure it reloads the new credentials
      if (manager.get(phoneNumber)) {
          manager.stop(phoneNumber);
      }

      // Start the bot session
      const session = await manager.start(phoneNumber);
      return json(res, 200, { success: true, message: 'Session restored successfully!', phoneNumber });
    }
    if (req.method === 'GET' && url.pathname === '/api/pairing-code') {
      const number = url.searchParams.get('phoneNumber');
      const token = url.searchParams.get('accessToken');
      const session = manager.get(number);
      if (!session || session.accessToken !== token) return json(res, 403, { success: false, error: 'Invalid or expired session token.' });
      return json(res, 200, { success: true, status: session.status, code: session.code, qr: session.qr, error: session.error || null, phoneNumber: session.number, pid: session.pid });
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

async function startServer() {
  const restored = await manager.restoreSavedSessions();
  if (restored.length) console.log(`[mesh-multi-user] Restoring ${restored.length} saved WhatsApp session(s).`);
  server.listen(port, '0.0.0.0', () => console.log(`[mesh-multi-user] MESH TECH MD pairing server listening on ${port}`));
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('[mesh-multi-user] Failed to start pairing server:', error);
    process.exitCode = 1;
  });
}

module.exports = { server, manager, startServer };
