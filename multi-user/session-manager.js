'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

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

  get(number) {
    return this.sessions.get(this.normalizePhoneNumber(number));
  }

  count() {
    return this.sessions.size;
  }

  list() {
    return [...this.sessions.values()].map(({ number, status, code, pid, startedAt, lastOutput }) => ({
      number, status, code: code || null, pid: pid || null, startedAt, lastOutput,
    }));
  }

  async start(number) {
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
      startedAt: new Date().toISOString(),
      lastOutput: '',
      child: null,
    };

    const child = spawn(process.execPath, [this.botEntry], {
      cwd: authDir,
      // Supply the selected user's number directly to the isolated bot. The
      // bot treats child-process stdin as non-interactive on Railway.
      env: { ...process.env, MESH_PAIRING_PHONE_NUMBER: normalized },
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
      const codeMatch = output.match(/PAIRING_CODE\s+([A-Z0-9-]+)/i)
        || output.match(/(?:pairing code|Pair this device using this code)[^\n]*\n?\s*([A-Z0-9]{4,8}(?:-[A-Z0-9]{4,8})?)/i);
      if (codeMatch) {
        record.code = codeMatch[1];
        record.status = 'pairing_code_ready';
      }
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
      pid: record.pid,
      authDir: record.authDir,
    };
  }
}

module.exports = { MultiUserSessionManager };
