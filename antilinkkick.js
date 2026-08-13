'use strict';

const fs = require('fs');
const path = require('path');

const stateDir = path.resolve(process.env.MESH_ANTILINKKICK_STATE_DIR || process.cwd());
const stateFile = path.join(stateDir, 'antilinkkick.json');
const linkPattern = /(chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me|bit\.ly|youtu\.be|https?:\/\/)/i;
const defaultWarning = '⚠️ {user}, links are not allowed in this group. You will be removed now.';

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

function normalizeJid(jid) {
  return String(jid || '').replace(/:\d+(?=@)/, '');
}

function isAntilinkKickEnabled(jid) {
  const saved = enabledChats[jid];
  return saved === true || Boolean(saved && typeof saved === 'object' && saved.enabled === true);
}

function getWarningTemplate(jid) {
  const saved = enabledChats[jid];
  return typeof saved === 'object' && typeof saved.warning === 'string' && saved.warning.trim()
    ? saved.warning.trim()
    : defaultWarning;
}

function updateGroupState(jid, changes) {
  const saved = enabledChats[jid];
  const current = typeof saved === 'object'
    ? saved
    : { enabled: saved === true, warning: defaultWarning };
  enabledChats[jid] = { ...current, ...changes };
  saveState();
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
    return reply(`🛡️ *Anti-link kick:* ${isAntilinkKickEnabled(jid) ? 'ENABLED ✅' : 'DISABLED ❌'}\n┃ Applies to: *This group*\n┃ Warning: ${getWarningTemplate(jid)}`);
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

  if (!['on', 'off'].includes(option)) {
    return reply('Usage: *.antilinkkick on* | *.antilinkkick off* | *.antilinkkick status* | *.antilinkkick warning <message>*');
  }

  updateGroupState(jid, { enabled: option === 'on' });
  global.antilinkkick = global.antilinkkick || {};
  global.antilinkkick[jid] = isAntilinkKickEnabled(jid);

  return reply(`🛡️ Anti-link kick is now *${isAntilinkKickEnabled(jid) ? 'ENABLED ✅' : 'DISABLED ❌'}* for this group.\n┃ The bot must be a group admin to remove non-admin link senders.`);
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
    const isAdmin = (participant) => Boolean(participant && (participant.admin === 'admin' || participant.admin === 'superadmin' || participant.isAdmin));

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
    await conn.sendMessage(jid, {
      text: renderWarning(getWarningTemplate(jid), sender),
      mentions: [sender],
    });
    const wait = typeof waitForWarning === 'function'
      ? waitForWarning
      : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    await wait(750);
    await conn.groupParticipantsUpdate(jid, [sender], 'remove');
    await conn.sendMessage(jid, {
      text: `⚠️ @${sender.split('@')[0]} was removed for posting a prohibited link.`,
      mentions: [sender],
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
  renderWarning,
  textFromMessage,
};
