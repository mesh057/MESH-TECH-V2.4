'use strict';

const assert = require('assert');
const {
  CommandRateLimiter,
  commandSenderKey,
  formatCooldown,
  rateLimitConfig,
} = require('./multi-user/command-rate-limiter');

function message(chatId, sender) {
  return { key: { remoteJid: chatId, participant: sender, fromMe: false } };
}

function main() {
  let now = 10_000;
  const limiter = new CommandRateLimiter({ maxCommands: 2, windowMs: 5_000, now: () => now, maxEntries: 10 });
  const userA = commandSenderKey(message('120363000001@g.us', '254711111111@s.whatsapp.net'));
  const userB = commandSenderKey(message('120363000001@g.us', '254722222222@s.whatsapp.net'));

  assert.deepStrictEqual(limiter.consume(userA), { allowed: true, shouldNotify: false, retryAfterMs: 0 });
  assert.deepStrictEqual(limiter.consume(userA), { allowed: true, shouldNotify: false, retryAfterMs: 0 });

  const blocked = limiter.consume(userA);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.shouldNotify, true);
  assert.strictEqual(blocked.retryAfterMs, 5_000);
  assert.match(formatCooldown(blocked.retryAfterMs), /5 seconds/);

  const repeatedBlock = limiter.consume(userA);
  assert.strictEqual(repeatedBlock.allowed, false);
  assert.strictEqual(repeatedBlock.shouldNotify, false, 'Repeated spam should not generate a notification flood.');

  assert.deepStrictEqual(limiter.consume(userB), { allowed: true, shouldNotify: false, retryAfterMs: 0 }, 'One user must not consume another user’s allowance.');

  now += 5_001;
  assert.deepStrictEqual(limiter.consume(userA), { allowed: true, shouldNotify: false, retryAfterMs: 0 }, 'Allowance must recover after the rolling window expires.');

  assert.deepStrictEqual(rateLimitConfig({ MESH_COMMAND_RATE_LIMIT_MAX: '4', MESH_COMMAND_RATE_LIMIT_WINDOW_MS: '6000' }), {
    maxCommands: 4,
    windowMs: 6000,
    maxEntries: 10_000,
  });
  const indexSource = require('fs').readFileSync(require('path').join(__dirname, 'index.js'), 'utf8');
  assert.match(indexSource, /commandRateLimiter\.consume\(commandSenderKey\(msg\)\)/,
    'The live WhatsApp dispatcher must consume a per-user command allowance before command execution.');
  assert.match(indexSource, /imageMessage\?\.caption/,
    'Caption-based media commands must receive the same anti-spam protection as text commands.');
  console.log('PASS: Per-user command rate limiting enforces a bounded cooldown, avoids notification spam, and recovers fairly.');
}

main();
