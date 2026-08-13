'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeJid, isAdmin, notifyGroupAdmins } = require('./protection-log');

const stateDir = path.resolve(process.env.MESH_ANTILINKKICK_STATE_DIR || process.cwd());
const stateFile = path.join(stateDir, 'antilinkkick.json');
const linkPattern = /(chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me|bit\.ly|youtu\.be|https?:\/\/)/i;
const defaultWarning = '⚠️ {user}, links are not allowed in this group.';
const legacyDefaultWarning = '⚠️ {user}, links are not allowed in this group. You will be removed now.';
const defaultStrikeLimit = 3;
const minimumStrikeLimit = 1;
const maximumStrikeLimit = 10;

fs.mkdirSync(stateDir, { recursive: true });

let enabledChats = {};
try {
  if (fs.existsSync(stateFile)) enabledChats = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
} catch {
  enabledChats = {};
}

function saveState() {
  fs.writeFileSync(stateFile, JSON.stringify(enabledChats, null, 2));
}

function isAntilinkKickEnabled(jid) {
  const saved = enabledChats[jid];
  return saved === true || Boolean(saved && typeof saved === 'object' && saved.enabled === true);
}

function getWarningTemplate(jid) {
  const saved = enabledChats[jid];
  const warning = typeof saved === 'object' && typeof saved.warning === 'string'
    ? saved.warning.trim()
    : '';
  return warning && warning !== legacyDefaultWarning ? warning : defaultWarning;
}

function getStrikeLimit(jid) {
  const saved = enabledChats[jid];
  const limit = Number(typeof saved === 'object' ? saved.strikeLimit : undefined);
  return Number.isInteger(limit) && limit >= minimumStrikeLimit && limit <= maximumStrikeLimit
    ? limit
    : defaultStrikeLimit;
}

function getStrikeCount(jid, sender) {
  const saved = enabledChats[jid];
  const strikes = typeof saved === 'object' && saved.strikes && typeof saved.strikes === 'object'
    ? saved.strikes
    : {};
  const count = Number(strikes[normalizeJid(sender)]);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function updateGroupState(jid, changes) {
  const saved = enabledChats[jid];
  const current = typeof saved === 'object'
    ? saved
    : {
      enabled: saved === true,
      warning: defaultWarning,
      strikeLimit: defaultStrikeLimit,
      strikes: {},
    };
  enabledChats[jid] = { ...current, ...changes };
  saveState();
}

function addStrike(jid, sender) {
  const normalizedSender = normalizeJid(sender);
  const saved = enabledChats[jid];
  const currentStrikes = typeof saved === 'object' && saved.strikes && typeof saved.strikes === 'object'
    ? saved.strikes
    : {};
  const count = getStrikeCount(jid, normalizedSender) + 1;
  updateGroupState(jid, {
    strikes: { ...currentStrikes, [normalizedSender]: count },
  });
  return count;
}

function clearStrikes(jid, sender) {
  if (!sender) {
    updateGroupState(jid, { strikes: {} });
    return;
  }

  const normalizedSender = normalizeJid(sender);
  const saved = enabledChats[jid];
  const currentStrikes = typeof saved === 'object' && saved.strikes && typeof saved.strikes === 'object'
    ? saved.strikes
    : {};
  const strikes = { ...currentStrikes };
  delete strikes[normalizedSender];
  updateGroupState(jid, { strikes });
}

function renderWarning(template, sender) {
  const mention = `@${sender.split('@')[0]}`;
  const replaced = String(template || defaultWarning).replace(/\{user\}|@user/gi, mention);
  return replaced.includes(mention) ? replaced : `${mention}\n${replaced}`;
}

function textFromMessage(message) {
  return message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    '';
}

async function configureAntilinkKick({ m, args, reply, jid, isGroup }) {
  if (!isGroup || !jid?.endsWith('@g.us')) {
    return reply('🚫 *GROUP ONLY!* Use `.antilinkkick` inside the group you want to protect.');
  }

  const option = (args[0] || '').toLowerCase();
  if (option === 'status') {
    return reply(`🛡️ *Anti-link kick:* ${isAntilinkKickEnabled(jid) ? 'ENABLED ✅' : 'DISABLED ❌'}\n┃ Applies to: *This group*\n┃ Warnings before removal: *${getStrikeLimit(jid)}*\n┃ Warning: ${getWarningTemplate(jid)}`);
  }

  if (option === 'warning') {
    const requestedTemplate = args.slice(1).join(' ').trim();
    if (!requestedTemplate) {
      return reply(`Usage: *.antilinkkick warning Your message with {user}*\n┃ Current: ${getWarningTemplate(jid)}`);
    }
    if (requestedTemplate.toLowerCase() === 'reset') {
      updateGroupState(jid, { warning: defaultWarning });
      return reply('🛡️ Anti-link-kick warning reset to the default message.');
    }
    if (requestedTemplate.length > 600) {
      return reply('⚠️ Keep the anti-link-kick warning under 600 characters.');
    }
    updateGroupState(jid, { warning: requestedTemplate });
    return reply(`🛡️ Anti-link-kick warning saved.\n┃ Preview: ${renderWarning(requestedTemplate, 'user@s.whatsapp.net')}`);
  }

  if (option === 'strikes') {
    const requestedLimit = (args[1] || '').toLowerCase();
    if (requestedLimit === 'clear') {
      clearStrikes(jid);
      return reply('🛡️ All saved anti-link strikes were cleared for this group.');
    }
    if (!requestedLimit) {
      return reply(`Usage: *.antilinkkick strikes <${minimumStrikeLimit}-${maximumStrikeLimit}>* | *.antilinkkick strikes clear*\n┃ Current limit: *${getStrikeLimit(jid)} warnings before removal*`);
    }
    const limit = Number(requestedLimit);
    if (!Number.isInteger(limit) || limit < minimumStrikeLimit || limit > maximumStrikeLimit) {
      return reply(`⚠️ Choose a whole number from ${minimumStrikeLimit} to ${maximumStrikeLimit} warnings before removal.`);
    }
    updateGroupState(jid, { strikeLimit: limit, strikes: {} });
    return reply(`🛡️ Anti-link strike limit set to *${limit}*.\n┃ A non-admin member is removed after ${limit} prohibited-link warning${limit === 1 ? '' : 's'}.\n┃ Existing strikes were cleared for a fair start.`);
  }

  if (!['on', 'off'].includes(option)) {
    return reply('Usage: *.antilinkkick on* | *.antilinkkick off* | *.antilinkkick status* | *.antilinkkick warning <message>* | *.antilinkkick strikes <1-10|clear>*');
  }

  updateGroupState(jid, { enabled: option === 'on' });
  global.antilinkkick = global.antilinkkick || {};
  global.antilinkkick[jid] = isAntilinkKickEnabled(jid);

  return reply(`🛡️ Anti-link kick is now *${isAntilinkKickEnabled(jid) ? 'ENABLED ✅' : 'DISABLED ❌'}* for this group.\n┃ Default policy: *${getStrikeLimit(jid)} warnings before removal.*\n┃ The bot must be a group admin to remove non-admin link senders.`);
}

async function checkAntilinkKick({ conn, m, waitForWarning }) {
  const jid = m?.key?.remoteJid;
  if (!jid?.endsWith('@g.us') || m.key.fromMe || !isAntilinkKickEnabled(jid)) return false;

  const text = textFromMessage(m);
  if (!linkPattern.test(text)) return false;

  const sender = normalizeJid(m.key.participant || m.participant);
  if (!sender) return false;

  try {
    const metadata = await conn.groupMetadata(jid);
    const participants = metadata?.participants || [];
    const senderParticipant = participants.find((participant) => normalizeJid(participant.id || participant.jid) === sender);
    const botJid = normalizeJid(conn.user?.id || conn.user?.jid);
    const botParticipant = participants.find((participant) => normalizeJid(participant.id || participant.jid) === botJid);
    // Do not remove group admins or attempt an action the bot is not allowed to perform.
    if (isAdmin(senderParticipant) || !isAdmin(botParticipant)) return false;

    await conn.sendMessage(jid, {
      delete: {
        remoteJid: jid,
        fromMe: false,
        id: m.key.id,
        participant: m.key.participant || m.participant,
      },
    });
    const strikeCount = addStrike(jid, sender);
    const strikeLimit = getStrikeLimit(jid);
    const isFinalStrike = strikeCount >= strikeLimit;
    await conn.sendMessage(jid, {
      text: `${renderWarning(getWarningTemplate(jid), sender)}\n┃ Strike: *${strikeCount}/${strikeLimit}*${isFinalStrike ? '\n┃ Final strike — removal now follows.' : `\n┃ ${strikeLimit - strikeCount} warning${strikeLimit - strikeCount === 1 ? '' : 's'} remaining before removal.`}`,
      mentions: [sender],
    });
    if (!isFinalStrike) return true;

    const wait = typeof waitForWarning === 'function'
      ? waitForWarning
      : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    await wait(750);
    await conn.groupParticipantsUpdate(jid, [sender], 'remove');
    clearStrikes(jid, sender);
    await conn.sendMessage(jid, {
      text: `⚠️ @${sender.split('@')[0]} was removed after reaching the ${strikeLimit}-strike anti-link limit.`,
      mentions: [sender],
    });
    await notifyGroupAdmins({
      conn,
      jid,
      metadata,
      event: 'ANTI-LINK-KICK REMOVAL',
      details: `Action: Non-admin member +${sender.split('@')[0]} removed after *${strikeCount}/${strikeLimit}* prohibited-link strikes.`,
    });
    return true;
  } catch (error) {
    console.error('❌ AntiLinkKick enforcement error:', error.message || error);
    return false;
  }
}

module.exports = {
  configureAntilinkKick,
  checkAntilinkKick,
  isAntilinkKickEnabled,
  getWarningTemplate,
  getStrikeLimit,
  getStrikeCount,
  clearStrikes,
  renderWarning,
  textFromMessage,
};
