'use strict';

const DEFAULT_MAX_COMMANDS = 8;
const DEFAULT_WINDOW_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 10_000;

function positiveInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function rateLimitConfig(env = process.env) {
  return {
    maxCommands: positiveInteger(env.MESH_COMMAND_RATE_LIMIT_MAX, DEFAULT_MAX_COMMANDS, 1, 100),
    windowMs: positiveInteger(env.MESH_COMMAND_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS, 1_000, 300_000),
    maxEntries: positiveInteger(env.MESH_COMMAND_RATE_LIMIT_MAX_ENTRIES, DEFAULT_MAX_ENTRIES, 100, 100_000),
  };
}

function commandSenderKey(msg) {
  const key = msg?.key || {};
  const chatId = String(key.remoteJid || 'unknown-chat');
  const sender = String(key.senderPn || key.participantPn || key.participant || key.remoteJidAlt || key.remoteJid || 'unknown-sender');
  return `${chatId}:${sender}`;
}

class CommandRateLimiter {
  constructor(options = {}) {
    const config = { ...rateLimitConfig(options.env), ...options };
    this.maxCommands = config.maxCommands;
    this.windowMs = config.windowMs;
    this.maxEntries = config.maxEntries;
    this.now = config.now || Date.now;
    this.entries = new Map();
  }

  prune(now) {
    for (const [key, entry] of this.entries) {
      if (!entry.timestamps.length || entry.timestamps.at(-1) <= now - this.windowMs) this.entries.delete(key);
    }
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value);
  }

  consume(key) {
    const now = this.now();
    const cutoff = now - this.windowMs;
    const entry = this.entries.get(key) || { timestamps: [], notified: false };
    entry.timestamps = entry.timestamps.filter((timestamp) => timestamp > cutoff);

    if (entry.timestamps.length >= this.maxCommands) {
      const retryAfterMs = Math.max(1, entry.timestamps[0] + this.windowMs - now);
      const shouldNotify = !entry.notified;
      entry.notified = true;
      this.entries.set(key, entry);
      this.prune(now);
      return { allowed: false, shouldNotify, retryAfterMs };
    }

    entry.timestamps.push(now);
    entry.notified = false;
    this.entries.set(key, entry);
    this.prune(now);
    return { allowed: true, shouldNotify: false, retryAfterMs: 0 };
  }

  reset() {
    this.entries.clear();
  }
}

function formatCooldown(retryAfterMs) {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `⏳ Please slow down. You have reached the command limit for this chat. Try again in about ${seconds} second${seconds === 1 ? '' : 's'}.`;
}

module.exports = {
  CommandRateLimiter,
  commandSenderKey,
  formatCooldown,
  rateLimitConfig,
};
