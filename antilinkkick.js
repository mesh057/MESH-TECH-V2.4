'use strict';

const fs = require('fs');
const path = require('path');

const stateDir = path.resolve(process.env.MESH_ANTILINKKICK_STATE_DIR || process.cwd());
const stateFile = path.join(stateDir, 'antilinkkick.json');
const linkPattern = /(chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me|bit\.ly|youtu\.be|https?:\/\/)/i;

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
  return enabledChats[jid] === true;
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
    return reply(`🛡️ *Anti-link kick:* ${isAntilinkKickEnabled(jid) ? 'ENABLED ✅' : 'DISABLED ❌'}\n┃ Applies to: *This group*`);
  }

  if (!['on', 'off'].includes(option)) {
    return reply('Usage: *.antilinkkick on* | *.antilinkkick off* | *.antilinkkick status*');
  }

  enabledChats[jid] = option === 'on';
  global.antilinkkick = global.antilinkkick || {};
  global.antilinkkick[jid] = enabledChats[jid];
  saveState();

  return reply(`🛡️ Anti-link kick is now *${enabledChats[jid] ? 'ENABLED ✅' : 'DISABLED ❌'}* for this group.\n┃ The bot must be a group admin to remove non-admin link senders.`);
}

async function checkAntilinkKick({ conn, m }) {
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
  textFromMessage,
};
