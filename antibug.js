'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeJid, isAdmin, notifyGroupAdmins } = require('./protection-log');

const stateDir = path.resolve(process.env.MESH_ANTIBUG_STATE_DIR || process.cwd());
const stateFile = path.join(stateDir, 'antibug.json');
const maxTextLength = Number(process.env.MESH_ANTIBUG_MAX_TEXT_LENGTH || 5000);
const maxPayloadLength = Number(process.env.MESH_ANTIBUG_MAX_PAYLOAD_LENGTH || 24000);
const maxInvisibleCharacters = Number(process.env.MESH_ANTIBUG_MAX_INVISIBLE_CHARACTERS || 512);

fs.mkdirSync(stateDir, { recursive: true });

let enabledGroups = {};
try {
  if (fs.existsSync(stateFile)) enabledGroups = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
} catch {
  enabledGroups = {};
}

function saveState() {
  fs.writeFileSync(stateFile, JSON.stringify(enabledGroups, null, 2));
}

function isAntiBugEnabled(jid) {
  return enabledGroups[jid] === true;
}

function messageText(m) {
  return m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    m?.message?.imageMessage?.caption ||
    m?.message?.videoMessage?.caption ||
    '';
}

function isSuspiciousMessage(m) {
  const text = messageText(m);
  const serialized = JSON.stringify(m?.message || {});
  const invisibleCount = (text.match(/[\u200B-\u200F\u2060\uFEFF\uFFF0-\uFFFF]/g) || []).length;

  return text.length > maxTextLength ||
    serialized.length > maxPayloadLength ||
    invisibleCount > maxInvisibleCharacters;
}

async function configureAntiBug({ args, reply, jid, isGroup }) {
  if (!isGroup || !jid?.endsWith('@g.us')) {
    return reply('🚫 *GROUP ONLY!* Use `.antibug` inside the group you want to protect.');
  }

  const option = (args[0] || '').toLowerCase();
  if (option === 'status') {
    return reply(`🛡️ *Anti-bug:* ${isAntiBugEnabled(jid) ? 'ENABLED ✅' : 'DISABLED ❌'}\n┃ Applies to: *This group*\n┃ Removes only suspicious oversized or invisible-character spam from non-admin members.`);
  }
  if (!['on', 'off'].includes(option)) {
    return reply('Usage: *.antibug on* | *.antibug off* | *.antibug status*');
  }

  enabledGroups[jid] = option === 'on';
  saveState();
  return reply(`🛡️ Anti-bug protection is now *${enabledGroups[jid] ? 'ENABLED ✅' : 'DISABLED ❌'}* for this group.\n┃ The bot must be a group admin to delete suspicious non-admin messages.`);
}

async function antibugHandler({ conn, m }) {
  const jid = m?.key?.remoteJid;
  if (!jid?.endsWith('@g.us') || m.key.fromMe || !isAntiBugEnabled(jid) || !isSuspiciousMessage(m)) return false;

  const sender = normalizeJid(m.key.participant || m.participant);
  if (!sender) return false;

  try {
    const metadata = await conn.groupMetadata(jid);
    const participants = metadata?.participants || [];
    const senderParticipant = participants.find((participant) => normalizeJid(participant.id || participant.jid) === sender);
    const botJid = normalizeJid(conn.user?.id || conn.user?.jid);
    const botParticipant = participants.find((participant) => normalizeJid(participant.id || participant.jid) === botJid);

    // Preserve group-admin messages and do not act unless the bot itself is a group admin.
    if (isAdmin(senderParticipant) || !isAdmin(botParticipant)) return false;

    await conn.sendMessage(jid, {
      delete: {
        remoteJid: jid,
        fromMe: false,
        id: m.key.id,
        participant: m.key.participant || m.participant,
      },
    });
    await notifyGroupAdmins({
      conn,
      jid,
      metadata,
      event: 'ANTI-BUG MESSAGE REMOVAL',
      details: `Action: Suspicious oversized or invisible-character message from +${sender.split('@')[0]} was removed.`,
    });
    return true;
  } catch (error) {
    console.error('❌ AntiBug enforcement error:', error.message || error);
    return false;
  }
}

module.exports = {
  antibugHandler,
  configureAntiBug,
  isAntiBugEnabled,
  isSuspiciousMessage,
  messageText,
};
