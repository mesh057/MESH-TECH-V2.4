'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

function extractPairingCode(output) {
  const match = String(output || '').match(/\bPAIRING_CODE\s+([A-Z0-9]{4,8}(?:-[A-Z0-9]{4,8})?)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function extractPairingQr(output) {
  const match = String(output || '').match(/\bPAIRING_QR\s+([^\n\r]+)/i);
  return match ? match[1].trim() : null;
}

function extractPairingError(output) {
  const match = String(output || '').match(/\bPAIRING_ERROR\s+([^\n\r]+)/i);
  return match ? match[1].trim().slice(0, 240) : null;
}

class MultiUserSessionManager {
  constructor(options = {}) {
    this.rootDir = path.resolve(options.rootDir || process.env.MULTI_USER_AUTH_DIR || 'auth_sessions');
    this.botEntry = path.resolve(options.botEntry || path.join(__dirname, '..', 'index.js'));
    this.sessions = new Map();
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  normalizePhoneNumber(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) throw new Error('Enter a valid phone number with country code.');
    return digits;
  }

  sessionDir(number) {
    return path.join(this.rootDir, this.normalizePhoneNumber(number));
  }

  listRestorableSessions() {
    try {
      return fs.readdirSync(this.rootDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d{8,15}$/.test(entry.name))
        .map((entry) => entry.name)
        .filter((number) => {
          const credsPath = path.join(this.sessionDir(number), 'auth_info', 'creds.json');
          try {
            return Boolean(JSON.parse(fs.readFileSync(credsPath, 'utf8')).registered);
          } catch {
            return false;
          }
        });
    } catch (error) {
      console.error('[mesh-multi-user] Could not inspect stored sessions:', error.message);
      return [];
    }
  }

  async restoreSavedSessions() {
    const restored = [];
    for (const number of this.listRestorableSessions()) {
      try {
        await this.start(number);
        restored.push(number);
      } catch (error) {
        console.error(`[mesh-multi-user] Could not restore ${number}:`, error.message);
      }
    }
    return restored;
  }

  get(number) {
    return this.sessions.get(this.normalizePhoneNumber(number));
  }

  count() {
    return this.sessions.size;
  }

  list() {
    return [...this.sessions.values()].map(({ number, status, code, qr, pid, startedAt, lastOutput }) => ({
      number, status, code: code || null, qr: qr || null, pid: pid || null, startedAt, lastOutput,
    }));
  }

  async start(number, useQr = false) {
    const normalized = this.normalizePhoneNumber(number);
    const existing = this.sessions.get(normalized);
    if (existing && !existing.child.killed) return this.publicSession(existing);

    const authDir = this.sessionDir(normalized);
    fs.mkdirSync(authDir, { recursive: true });
    const accessToken = crypto.randomBytes(32).toString('hex');
    const record = {
      number: normalized,
      accessToken,
      authDir,
      status: 'starting',
      code: null,
      qr: null,
      error: null,
      startedAt: new Date().toISOString(),
      lastOutput: '',
      outputBuffer: '',
      child: null,
    };

    const child = spawn(process.execPath, [this.botEntry], {
      cwd: authDir,
      // Supply the selected user's number directly to the isolated bot. The
      // bot treats child-process stdin as non-interactive on Railway.
      env: {
        ...process.env,
        MESH_PAIRING_PHONE_NUMBER: normalized,
        MESH_MULTI_USER_SESSION_OWNER: normalized,
        MESH_MULTI_USER_SESSION_MODE: 'public',
        MESH_PAIRING_MODE: useQr ? 'qr' : 'code',
      },
      // The original bot keeps using auth_info; running it from this user’s
      // directory makes that relative path unique without editing its code.
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    record.child = child;
    record.pid = child.pid;
    this.sessions.set(normalized, record);
    const consume = (chunk) => {
      const output = String(chunk);
      record.lastOutput = output.trim().slice(-2000);
      record.outputBuffer = `${record.outputBuffer}${output}`.slice(-5000);
      const code = extractPairingCode(record.outputBuffer);
      if (code) {
        record.code = code;
        record.error = null;
        record.status = 'pairing_code_ready';
      }
      const qr = extractPairingQr(record.outputBuffer);
      if (qr) {
        record.qr = qr;
        record.error = null;
        record.status = 'pairing_qr_ready';
      }
      const pairingError = extractPairingError(record.outputBuffer);
      if (pairingError && !record.code) {
        record.error = pairingError;
        record.status = 'error';
      }
      if (/Connecting\.\.\./i.test(output)) record.status = 'connecting';
      if (/Watchdog triggered/i.test(output)) record.status = 'retrying';
      if (/BOT OWNER|Connected|connection open/i.test(output) && !record.code) record.status = 'running';
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    child.on('error', (error) => {
      record.status = 'error';
      record.lastOutput = error.message;
    });
    child.on('exit', (code, signal) => {
      if (record.status !== 'stopped') record.status = code === 0 ? 'stopped' : 'error';
      record.exitCode = code;
      record.signal = signal;
      if (record.status === 'error' && !record.error) record.error = record.lastOutput || 'The WhatsApp pairing session stopped unexpectedly.';
    });

    return this.publicSession(record);
  }

  stop(number) {
    const normalized = this.normalizePhoneNumber(number);
    const record = this.sessions.get(normalized);
    if (!record) return false;
    record.status = 'stopped';
    if (record.child && !record.child.killed) record.child.kill('SIGTERM');
    this.sessions.delete(normalized);
    return true;
  }

  publicSession(record) {
    return {
      number: record.number,
      accessToken: record.accessToken,
      status: record.status,
      code: record.code,
      qr: record.qr,
      error: record.error,
      pid: record.pid,
      authDir: record.authDir,
    };
  }
}

module.exports = { MultiUserSessionManager, extractPairingCode, extractPairingError };
