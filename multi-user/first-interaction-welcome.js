'use strict';

const WELCOME_STORE_KEY = 'firstInteractionWelcomeedContacts';

function messageText(msg) {
  return String(
    msg?.message?.conversation
    || msg?.message?.extendedTextMessage?.text
    || msg?.message?.imageMessage?.caption
    || msg?.message?.videoMessage?.caption
    || ''
  ).trim();
}

function senderId(msg) {
  return String(msg?.key?.senderPn || msg?.key?.participant || msg?.key?.remoteJid || '');
}

function replyJid(msg) {
  const jid = String(msg?.key?.remoteJid || '');
  return jid.endsWith('@lid') && msg?.key?.senderPn ? msg.key.senderPn : jid;
}

function isEligibleFirstInteraction(msg) {
  const jid = String(msg?.key?.remoteJid || '');
  if (!jid || msg?.key?.fromMe) return false;
  if (jid === 'status@broadcast' || jid.endsWith('@g.us')) return false;
  if (msg?.message?.protocolMessage || msg?.message?.reactionMessage) return false;
  return Boolean(senderId(msg));
}

function isHelpRequest(msg) {
  return /^\.help(?:\s|$)/i.test(messageText(msg));
}

async function welcomeFirstInteraction({ runtime, sock, msg, botName = process.env.BOT_NAME || 'MESH TECH MD' }) {
  if (!runtime?.resources?.settings || !isEligibleFirstInteraction(msg)) {
    return { welcomed: false, reason: 'not-eligible' };
  }

  const contact = senderId(msg);
  const greetedContacts = runtime.resources.settings.get(WELCOME_STORE_KEY, {});
  if (greetedContacts[contact]) return { welcomed: false, reason: 'already-welcomed' };

  // Persist before sending so duplicate WhatsApp upserts or a quick restart do not
  // send the onboarding guide repeatedly to the same person.
  runtime.resources.settings.set(WELCOME_STORE_KEY, {
    ...greetedContacts,
    [contact]: new Date().toISOString(),
  });

  const jid = replyJid(msg);
  await sock.sendMessage(jid, {
    text: `👋 *Welcome to ${botName}!*\n\nI can help with media, utilities, group tools, games, and MESH AI. Here is the current command guide for this bot session.`,
  }, { quoted: msg });

  if (!isHelpRequest(msg)) {
    const result = await runtime.execute('help', sock, msg, []);
    return { welcomed: true, helpSent: result.handled };
  }

  // Let the standard command dispatcher service a first message of `.help`.
  // This avoids sending the same guide twice while still delivering it once.
  return { welcomed: true, helpSent: false };
}

module.exports = {
  WELCOME_STORE_KEY,
  isEligibleFirstInteraction,
  welcomeFirstInteraction,
};
