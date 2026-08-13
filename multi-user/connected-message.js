'use strict';

const fs = require('fs');
const path = require('path');

const officialGroupUrl = process.env.OFFICIAL_GROUP_INVITE || 'https://chat.whatsapp.com/DM1JxxnOJFp0vsTHpej89M';
const officialChannelUrl = process.env.OFFICIAL_CHANNEL_URL || 'https://whatsapp.com/channel/0029VbDeTrNEKyZ9GlUude2R';
const logoPath = path.join(__dirname, '..', 'v22-engine', 'media', 'MESH.jpg');

function connectedMessageEnabled() {
  return String(process.env.MESH_CONNECTED_MESSAGE_ENABLED || 'true').trim().toLowerCase() !== 'false';
}

function ownJid(sock) {
  const raw = String(sock?.user?.id || '');
  const number = raw.split('@')[0].split(':')[0].replace(/\D/g, '');
  return number ? `${number}@s.whatsapp.net` : null;
}

function connectedCaption({ ownerNumber, commandCount }) {
  return [
    '*MESH-TECH MD BOT CONNECTED* 🚀',
    '',
    '*Status:* Online & Active ✅',
    `*Owner:* @${ownerNumber}`,
    '*Mode:* Public • Multi-user session',
    `*Commands:* ${commandCount} loaded`,
    '',
    '> Type *.menu* to explore the command directory.',
    '',
    '👥 *Join our community group:*',
    officialGroupUrl,
    '',
    '📢 *Follow our WhatsApp channel:*',
    officialChannelUrl,
    '',
    '*Powered by MESH TECH* ⚡',
  ].join('\n');
}

async function sendConnectedMessage(sock, { ownerNumber, commandCount }) {
  const jid = ownJid(sock);
  if (!jid) throw new Error('The connected WhatsApp JID is unavailable.');
  const caption = connectedCaption({ ownerNumber, commandCount });
  const payload = fs.existsSync(logoPath)
    ? { image: fs.readFileSync(logoPath), caption }
    : { text: caption };
  return sock.sendMessage(jid, payload, { mentions: [`${ownerNumber}@s.whatsapp.net`] });
}

module.exports = { connectedCaption, connectedMessageEnabled, officialChannelUrl, officialGroupUrl, ownJid, sendConnectedMessage };
