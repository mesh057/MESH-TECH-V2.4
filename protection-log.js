'use strict';

const fs = require('fs');
const path = require('path');

const stateDir = path.resolve(process.env.MESH_PROTECTION_LOG_STATE_DIR || process.cwd());
const stateFile = path.join(stateDir, 'protection-log.json');

fs.mkdirSync(stateDir, { recursive: true });

let groupLoggingState = {};
try {
  if (fs.existsSync(stateFile)) groupLoggingState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
} catch {
  groupLoggingState = {};
}

function saveState() {
  fs.writeFileSync(stateFile, JSON.stringify(groupLoggingState, null, 2));
}

function normalizeJid(jid) {
  return String(jid || '').replace(/:\d+(?=@)/, '');
}

function isAdmin(participant) {
  return Boolean(participant && (participant.admin === 'admin' || participant.admin === 'superadmin' || participant.isAdmin));
}

function groupAdminJids(metadata, botJid) {
  const normalizedBotJid = normalizeJid(botJid);
  return (metadata?.participants || [])
    .filter(isAdmin)
    .map((participant) => normalizeJid(participant.id || participant.jid))
    .filter((jid) => jid && jid !== normalizedBotJid);
}

function mentionLabel(jid) {
  return `@${jid.split('@')[0]}`;
}

function isProtectionLoggingEnabled(jid) {
  // Existing groups keep logging enabled unless an authorized group admin
  // explicitly turns it off.
  return groupLoggingState[jid] !== false;
}

function setProtectionLoggingEnabled(jid, enabled) {
  groupLoggingState[jid] = Boolean(enabled);
  saveState();
  return groupLoggingState[jid];
}

async function configureProtectionLog({ args, reply, jid, isGroup }) {
  if (!isGroup || !jid?.endsWith('@g.us')) {
    return reply('🚫 *GROUP ONLY!* Use `.protectionlog` inside the group you want to configure.');
  }

  const option = (args[0] || '').toLowerCase();
  if (option === 'status') {
    return reply(`🔔 *Protection incident logging:* ${isProtectionLoggingEnabled(jid) ? 'ENABLED ✅' : 'DISABLED ❌'}\n┃ Applies to: *This group*\n┃ Controls verified-admin logs from anti-bug and anti-link-kick removals.`);
  }
  if (!['on', 'off'].includes(option)) {
    return reply('Usage: *.protectionlog on* | *.protectionlog off* | *.protectionlog status*');
  }

  const enabled = setProtectionLoggingEnabled(jid, option === 'on');
  return reply(`🔔 Protection incident logging is now *${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}* for this group.`);
}

async function notifyGroupAdmins({ conn, jid, metadata, event, details }) {
  if (!isProtectionLoggingEnabled(jid)) return [];
  const adminJids = groupAdminJids(metadata, conn?.user?.id || conn?.user?.jid);
  if (!adminJids.length) return [];

  const adminMentions = adminJids.map(mentionLabel).join(' ');
  const groupName = metadata?.subject ? `\n┃ Group: *${metadata.subject}*` : '';
  try {
    await conn.sendMessage(jid, {
      text: `🔔 *MESH PROTECTION LOG*\n┃ Event: *${event}*${groupName}\n┃ ${details}\n┃ Admins: ${adminMentions}`,
      mentions: adminJids,
    });
    return adminJids;
  } catch (error) {
    console.error('❌ Protection admin-log delivery error:', error.message || error);
    return [];
  }
}

module.exports = {
  normalizeJid,
  isAdmin,
  groupAdminJids,
  isProtectionLoggingEnabled,
  setProtectionLoggingEnabled,
  configureProtectionLog,
  notifyGroupAdmins,
};
