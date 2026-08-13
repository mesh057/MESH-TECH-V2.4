// Clean & Readable Command Handler
const fs = require("fs");
const path = require("path");
const { generateWAMessageFromContent } = require("@whiskeysockets/baileys");
const { isAntideleteEnabled, isPrivateForwardingEnabled, toggleAntidelete, togglePrivateForwarding } = require("../antidelete");
const autoreactControl = require("../autoreact");
const antilinkKickControl = require("../antilinkkick");
const protectionLogControl = require("../protection-log");
const meshAi = require("../ai");
const { setValue } = require("../system/storage");

// Default mode
if (!global.mode) global.mode = "self";

const commandAliases = {
  ask: "ai",
  autoview: "autostatus",
  autoviewstatus: "autostatus",
  antideleteforwarding: "antideleteforward",
  commands: "menu",
  command: "menu",
  help: "menu",
  mesh: "ai",
  statusview: "autostatus",
  viewstatus: "autostatus",
};

function normalizeJid(jid) {
  return String(jid || '').replace(/:\d+(?=@)/, '');
}

async function isGroupAdmin(conn, groupJid, senderId) {
  if (!groupJid?.endsWith('@g.us') || !senderId || typeof conn.groupMetadata !== 'function') return false;
  try {
    const metadata = await conn.groupMetadata(groupJid);
    const sender = normalizeJid(senderId);
    const participant = (metadata?.participants || []).find((item) => normalizeJid(item.id || item.jid) === sender);
    return Boolean(participant && (participant.admin === 'admin' || participant.admin === 'superadmin' || participant.isAdmin));
  } catch (error) {
    console.error('❌ Unable to verify anti-link-kick group-admin permission:', error.message || error);
    return false;
  }
}

// Owner-only commands list
const ownerOnlyCommands = [
  "video2", "song2", "kick", "add", "nice", "tagall",
  "antilink", "antilinkick", "autostatus", "autoreact", "autoreactstatus", "settings", "antideleteforward",
  "autogreet", "autotyping", "autoread", "block", "unblock",
  "shutdown", "restart", "setbio", "setname", "setpp", "save",
  "join", "delaymsg", "del", "reactch", "kickall", "antibug",
  "leave", "open", "close", "tagadmin", "hidetag", "listactive",
  "changename", "closetime", "warn", "promote", "demote",
  "promoteall", "demoteall", "say", "cpp", "harami", "ghostping",
  "adminkill", "delaymsg", "autorecording", "protectionlog"
];

// Load menu.js
const menuData = {};
try {
  const menuPath = path.join(__dirname, "..", "media", "menu.js");
  Object.assign(menuData, require(menuPath));
} catch (err) {
  console.error("❌ Error loading menu.js:", err);
}

// Optional command extension. The base bot works without menu/core.js.
let core = null;
try {
  const corePath = path.join(__dirname, "./core.js");
  core = require(corePath);
} catch (err) {
  if (err.code !== "MODULE_NOT_FOUND") console.error("❌ Error loading optional core.js:", err.message);
}

// ===============================
// 🔹 MAIN COMMAND HANDLER
// ===============================
async function handleCommand(conn, msg) {
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    "";

  if (!text.startsWith(".")) return;

  const parts = text.trim().split(/ +/);
  const rawCommand = parts[0].slice(1).toLowerCase();
  const command = commandAliases[rawCommand] || rawCommand;
  const args = parts.slice(1);

  const chatId = msg.key.remoteJid;
  const isGroup = chatId.endsWith("@g.us");
  const senderId = msg.key.fromMe
    ? conn.user.id.split(":")[0] + "@s.whatsapp.net"
    : msg.key.participant || msg.key.remoteJid;

  const senderNum = senderId.replace(/\D/g, "");
  const botNum = (conn.user.id || "").replace(/\D/g, "");
  const configuredOwners = (Array.isArray(global.owner) ? global.owner : [global.owner])
    .filter(Boolean)
    .map(jid => String(jid).replace(/\D/g, ""));
  const isOwner = configuredOwners.includes(senderNum) || senderNum === botNum;
  const isDev = false; // No hidden developer bypass; ownership is fully controlled by settings.js

  const reply = (text) => conn.sendMessage(chatId, { text }, { quoted: msg });

  // 🔸 Mode control
  if (command === "self") {
    if (!isOwner && !isDev)
      return reply("🚫 *Only Owner Can Switch Modes*");

    global.mode = "self";
    if (!global.isMultiUserSession) setValue("meshBotMode", "self");
    return reply("🔒 BOT IS NOW IN *SELF MODE* — Only Owner can use me!");
  }

  if (command === "public") {
    if (!isOwner && !isDev)
      return reply("🚫 *Only Owner Can Switch Modes*");

    global.mode = "public";
    if (!global.isMultiUserSession) setValue("meshBotMode", "public");
    return reply("🌍 BOT IS NOW IN *PUBLIC MODE* — Everyone can use me!");
  }

  // 🔸 Owner bypass
  if (isDev) {
    return runCommand({
      conn,
      msg,
      args,
      command,
      chatId,
      isGroup,
      senderNum,
      isOwner,
      reply
    });
  }

  const canManageAntilinkKick = ['antilinkkick', 'antilinkick'].includes(command) && isGroup && await isGroupAdmin(conn, chatId, senderId);
  const canManageProtectionLog = command === 'protectionlog' && isGroup && await isGroupAdmin(conn, chatId, senderId);

  // 🔸 Mode restrictions
  if (global.mode === "self" && !isOwner && !canManageAntilinkKick && !canManageProtectionLog && !["menu", "repo", "idcheck"].includes(command)) {
    return;
  }

  if (global.mode === "public" && ownerOnlyCommands.includes(command) && !isOwner && !canManageAntilinkKick && !canManageProtectionLog) {
    return reply("💀 *OWNER ONLY COMMAND!* You ain't my master londey!");
  }

  // 🔸 Direct calls
  if (["menu", "repo", "idcheck", "antidelete"].includes(command)) {
    return runCommand({
      conn,
      msg,
      args,
      command,
      chatId,
      isGroup,
      senderNum,
      isOwner,
      reply
    });
  }

  // Default
  return runCommand({
    conn,
    msg,
    args,
    command,
    chatId,
    isGroup,
    senderNum,
    isOwner,
    reply
  });
}

// ===============================
// 🔹 COMMAND EXECUTOR
// ===============================
async function runCommand({
  conn,
  msg,
  args,
  command,
  chatId,
  isGroup,
  senderNum,
  isOwner,
  reply
}) {
  try {
    // 🔸 idcheck
    if (command === "idcheck") {
      const botId = conn.user.id || "";
      return reply(
        `🤖 *Bot ID:* ${botId}\n📤 *Sender JID:* ${
          msg.key.participant || msg.key.remoteJid
        }\n🔢 *Sender Clean:* ${senderNum}`
      );
    }

    // 🔸 menu message
    if (menuData[command]) {
      const menuMessage = generateWAMessageFromContent(
        chatId,
        { extendedTextMessage: { text: menuData[command] } },
        { userJid: chatId }
      );
      return await conn.relayMessage(chatId, menuMessage.message, {
        messageId: menuMessage.key.id
      });
    }

    // 🔸 antidelete handler
    if (command === "antidelete") {
      return toggleAntidelete({ conn, m: msg, args, reply, jid: chatId });
    }

    if (command === "antideleteforward") {
      return togglePrivateForwarding({ args, reply });
    }

    if (command === "antilinkkick") {
      return antilinkKickControl.configureAntilinkKick({ m: msg, args, reply, jid: chatId, isGroup });
    }

    if (command === "antilinkick") {
      return antilinkKickControl.configureAntilinkKick({ m: msg, args, reply, jid: chatId, isGroup });
    }

    if (command === "antibug") {
      return require("../antibug").configureAntiBug({ args, reply, jid: chatId, isGroup });
    }

    if (command === "protectionlog") {
      return protectionLogControl.configureProtectionLog({ args, reply, jid: chatId, isGroup });
    }

    // 🔸 MESH AI
    if (command === "ai") {
      return meshAi.run({ args, chatId, sender: senderNum, isGroup, isOwner, reply });
    }

    if (command === "chatbot") {
      return meshAi.chatbot({ args, chatId, sender: senderNum, isGroup, isOwner, reply });
    }

    if (command === "autoreactstatus") {
      return autoreactControl.configureStatusReaction({ args, reply });
    }

    if (command === "settings") {
      const statusReact = autoreactControl.getStatusReactionState();
      return reply(
`╭━━━〔 *⚙️ MESH V2.4 SETTINGS* 〕━━━╮
┃ Mode: *${global.mode || "public"}*
┃ Anti-delete (this chat): *${isAntideleteEnabled(chatId) ? "ON" : "OFF"}*
┃ Private forwarding: *${isPrivateForwardingEnabled() ? "ON" : "OFF"}*
┃ Anti-link kick (this group): *${isGroup && antilinkKickControl.isAntilinkKickEnabled(chatId) ? "ON" : "OFF"}*
┃ Anti-link warnings before removal: *${isGroup ? antilinkKickControl.getStrikeLimit(chatId) : "—"}*
┃ Anti-bug (this group): *${isGroup && require("../antibug").isAntiBugEnabled(chatId) ? "ON" : "OFF"}*
┃ Protection logs (this group): *${isGroup && protectionLogControl.isProtectionLoggingEnabled(chatId) ? "ON" : "OFF"}*
┃ Auto-react (messages): *${autoreactControl.isAutoreactEnabled() ? "ON" : "OFF"}*
┃ Status auto-react: *${statusReact.enabled ? "ON" : "OFF"}*
┃ Status emoji: ${statusReact.emoji}
┃ Auto-status view: *${global.autostatus ? "ON" : "OFF"}*
╰━━━━━━━━━━━━━━━━━━━━━━╯`
      );
    }

    // 🔸 core functions
    if (core && core[command] && typeof core[command] === "function") {
      return await core[command]({
        conn,
        m: msg,
        args,
        command,
        jid: chatId,
        isGroup,
        sender: senderNum,
        reply
      });
    }

    // 🔸 individual command files
    const filePath = path.join(__dirname, "..", `${command}.js`);
    if (fs.existsSync(filePath)) {
      const commandFile = require(filePath);
      if (typeof commandFile === "function") {
        return await commandFile({ conn, m: msg, args, command, jid: chatId, isGroup, sender: senderNum, reply });
      }
      if (typeof commandFile.run === "function") {
        return await commandFile.run({ conn, m: msg, args, command, jid: chatId, isGroup, sender: senderNum, reply });
      }
    }

    // 🔸 unknown command
    return reply("*ᴜɴᴋɴᴏᴡɴ ᴄᴏᴍᴍᴀɴᴅ! ᴛʀʏ `.ᴍᴇɴᴜ` ʙᴇꜰᴏʀᴇ sʜᴏᴡɪɴɢ ᴏꜰꜰ 𓄀*");

  } catch (err) {
    console.error("⚠️ Error in command execution:", err);
    return reply("⚠️ Error in command execution!");
  }
}

// ===============================
// 🔹 Export
// ===============================
module.exports = {
  handleCommand
};
