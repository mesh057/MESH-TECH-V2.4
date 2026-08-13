'use strict';

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

async function notifyGroupAdmins({ conn, jid, metadata, event, details }) {
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
  notifyGroupAdmins,
};
