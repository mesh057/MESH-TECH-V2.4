// 📂 File: antidelete.js
// 🛡️ Ultra Pro Max Anti-Delete System — MESH TECH MD

const fs = require("fs");
const path = require("path");

const stateDir = path.resolve(process.env.MESH_ANTIDELETE_STATE_DIR || process.cwd());
const filePath = path.join(stateDir, "delete.json");
const toggleFile = path.join(stateDir, "antidelete.json");

fs.mkdirSync(stateDir, { recursive: true });

// ✅ Load or initialize toggles
let toggles = {};
if (fs.existsSync(toggleFile)) {
  try {
    toggles = JSON.parse(fs.readFileSync(toggleFile, "utf8"));
  } catch {
    toggles = {};
  }
}

const forwardingKey = "__privateForwardingEnabled";

// ✅ Save toggle settings
function saveToggles() {
  fs.writeFileSync(toggleFile, JSON.stringify(toggles, null, 2));
}

function isAntideleteEnabled(jid) {
  return toggles[jid] === true;
}

function isPrivateForwardingEnabled() {
  return toggles[forwardingKey] !== false;
}

function ownerPrivateJid() {
  const owner = Array.isArray(global.owner) ? global.owner[0] : global.owner;
  const digits = String(owner || "").replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : null;
}

function formatTimestamp(value) {
  const numeric = Number(value?.toString?.() || value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "Unknown";
  const milliseconds = numeric > 1e12 ? numeric : numeric * 1000;
  return new Date(milliseconds).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

async function sourceChatName(sock, jid) {
  if (!jid.endsWith("@g.us")) return "Direct chat";
  try {
    const metadata = await sock.groupMetadata(jid);
    return metadata?.subject || "Unnamed group";
  } catch (error) {
    console.error("❌ AntiDelete Group Metadata Error:", error.message);
    return "Unknown group";
  }
}

const deletedMessages = new Map();
let botId = null; // 🔥 Bot ki apni ID save karne ke liye

function removeStoredMessage(jid, id) {
  const chatMessages = deletedMessages.get(jid);
  if (!chatMessages) return;
  chatMessages.delete(id);
  if (chatMessages.size === 0) deletedMessages.delete(jid);

  const storedData = {};
  for (const [jidKey, msgMap] of deletedMessages.entries()) {
    storedData[jidKey] = {};
    for (const [msgId, messageData] of msgMap.entries()) {
      storedData[jidKey][msgId] = {
        key: messageData.key,
        message: messageData.message,
        pushName: messageData.pushName
      };
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(storedData, null, 2));
}

// ✅ Set Bot ID from connection
function setBotId(sock) {
  if (sock && sock.user && sock.user.id) {
    botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
  }
}

// ✅ Store message (skip bot’s own)
function storeMessage(msg) {
  const jid = msg.key.remoteJid;
  const id = msg.key.id;

  if (!jid || !id || !msg.message) return;

  // ⛔ Agar sender bot khud hai to skip
  const sender = msg.key.participant || msg.key.remoteJid;
  if (msg.key.fromMe || sender === botId) return;

  if (!deletedMessages.has(jid)) {
    deletedMessages.set(jid, new Map());
  }

  deletedMessages.get(jid).set(id, msg);

  // Optimization: Only save to disk periodically (every 20 messages) to reduce I/O lag in busy groups
  global.deleteSaveCounter = (global.deleteSaveCounter || 0) + 1;
  if (global.deleteSaveCounter % 20 === 0) {
    const storedData = {};
    for (const [jidKey, msgMap] of deletedMessages.entries()) {
      storedData[jidKey] = {};
      for (const [msgId, messageData] of msgMap.entries()) {
        storedData[jidKey][msgId] = {
          key: messageData.key,
          message: messageData.message,
          pushName: messageData.pushName
        };
      }
    }
    fs.writeFile(filePath, JSON.stringify(storedData, null, 2), (err) => {
      if (err) console.error("❌ AntiDelete Save Error:", err.message);
    });
  }
}

// ✅ TOGGLE Command
async function toggleAntidelete({ conn, m, args, reply, jid }) {
  const option = (args[0] || "").toLowerCase();
  if (option === "status") {
    return reply(
`〔 ✨ *ＡＮＴＩ－ＤＥＬＥＴＥ ＳＴＡＴＵＳ* ✨ 〕
┃ Protection: *${isAntideleteEnabled(jid) ? "ＥＮＡＢＬＥＤ ✅" : "ＤＩＳＡＢＬＥＤ ❌"}*
┃ Applies to: *This chat*
╰━━━━━━━━━━━━━━━━━━╯`
    );
  }

  if (!["on", "off"].includes(option)) {
    return reply(
`〔 ✨ *ＡＮＴＩ－ＤＥＬＥＴＥ* ✨ 〕
┃ 🛡️ Usage:
┃    🌸 *.antidelete on*   → 𝘌𝘯𝘢𝘣𝘭𝘦
┃    🌸 *.antidelete off*  → 𝘋𝘪𝘴𝘢𝘣𝘭𝘦
┃ 
┃ 💡 𝘛𝘩𝘪𝘴 𝘸𝘪𝘭𝘭 𝘴𝘢𝘷𝘦 & 𝘳𝘦𝘤𝘰𝘷𝘦𝘳
┃    𝘢𝘯𝘺 𝘥𝘦𝘭𝘦𝘵𝘦𝘥 𝘮𝘦𝘴𝘴𝘢𝘨𝘦𝘴 💬
╰━━━━━━━━━━━━━━━━━━╯`
    );
  }

  const enabled = option === "on";
  toggles[jid] = enabled;
  saveToggles();

  return reply(
`〔 💖 *ＡＮＴＩ－ＤＥＬＥＴＥ ＳＴＡＴＵＳ* 💖 〕
┃ 🔰 𝘗𝘳𝘰𝘵𝘦𝘤𝘵𝘪𝘰𝘯: *${enabled ? "ＥＮＡＢＬＥＤ ✅" : "ＤＩＳＡＢＬＥＤ ❌"}*
┃ 📌 𝘈𝘱𝘱𝘭𝘪𝘦𝘴 𝘵𝘰: *𝘛𝘩𝘪𝘴 𝘊𝘩𝘢𝘵*
┃ 
┃ 👑 𝑺𝒆𝒄𝒖𝒓𝒆𝒅 𝒃𝒚: ✨ 𝑻𝒂𝒚𝒚𝒂𝒃 𝑴𝑫 ✨
╰━━━━━━━━━━━━━━━━━━╯`
  );
}

async function togglePrivateForwarding({ args, reply }) {
  const option = (args[0] || "").toLowerCase();
  if (option === "status") {
    return reply(`🔒 *Anti-delete private forwarding:* ${isPrivateForwardingEnabled() ? "ENABLED ✅" : "DISABLED ❌"}`);
  }

  if (!["on", "off"].includes(option)) {
    return reply("Usage: *.antideleteforward on* | *.antideleteforward off* | *.antideleteforward status*");
  }

  toggles[forwardingKey] = option === "on";
  saveToggles();
  return reply(`🔒 Anti-delete private forwarding is now *${toggles[forwardingKey] ? "ENABLED ✅" : "DISABLED ❌"}*.`);
}

// ✅ Handle Message Revocation
async function handleMessageRevocation(sock, msg) {
  const jid = msg.key.remoteJid;
  const id = msg.message?.protocolMessage?.key?.id;

  if (!jid || !id || !deletedMessages.has(jid)) return;

  // ✅ Respect toggle setting
  if (!isAntideleteEnabled(jid)) return;

  const storedMsg = deletedMessages.get(jid).get(id);
  if (!storedMsg) return;

  if (!isPrivateForwardingEnabled()) {
    removeStoredMessage(jid, id);
    return;
  }

  // ⛔ Agar deleted msg bot ka khud ka tha to skip
  const sender = storedMsg.key.participant || storedMsg.key.remoteJid;
  if (storedMsg.key.fromMe || sender === botId) {
    removeStoredMessage(jid, id);
    return;
  }

  const senderName = storedMsg.pushName || sender || "𝑺𝒐𝒎𝒆𝒐𝒏𝒆";
  const messageContent = extractMessageContent(storedMsg);
  const ownerJid = ownerPrivateJid();

  if (!ownerJid) {
    console.error("❌ AntiDelete Error: no linked owner JID is available for private recovery delivery.");
    return;
  }

  const sourceType = jid.endsWith("@g.us") ? "Group chat" : "Direct chat";
  const chatName = await sourceChatName(sock, jid);
  const originalTimestamp = formatTimestamp(storedMsg.messageTimestamp);
  const recoveredTimestamp = formatTimestamp(Date.now());

  const infoText = 
`〔 ⚠️ *ＡＮＴＩ－ＤＥＬＥＴＥ ＤＥＴＥＣＴＥＤ* ⚠️ 〕
┃ 👤 𝘚𝘦𝘯𝘥𝘦𝘳: *${senderName}*
┃ 👥 Group: *${chatName}*
┃ 📍 Source: *${sourceType}*
┃ 🕓 Original: *${originalTimestamp}*
┃ 🕒 Recovered: *${recoveredTimestamp}*
┃ 🗑️ 𝘋𝘦𝘭𝘦𝘵𝘦𝘥 𝘮𝘴𝘨 𝘳𝘦𝘤𝘰𝘷𝘦𝘳𝘦𝘥 ✨
┃ 
┃ 🔒 Delivered privately to the linked owner
╰━━━━━━━━━━━━━━━━━━╯`;

  if (messageContent.text) {
    await sock.sendMessage(ownerJid, {
      text: `${infoText}\n\n🌸 *Message:* ${messageContent.text}`
    });
  } else if (messageContent.media) {
    await sock.sendMessage(ownerJid, {
      caption: infoText,
      [messageContent.type]: messageContent.media
    });
  }

  removeStoredMessage(jid, id);
}

// ✅ Extract message content
function extractMessageContent(msg) {
  const message = msg.message;

  if (!message) return { text: null };
  if (message.conversation) return { text: message.conversation };
  if (message.extendedTextMessage?.text) return { text: message.extendedTextMessage.text };
  if (message.imageMessage) return { type: "image", media: message.imageMessage };
  if (message.videoMessage) return { type: "video", media: message.videoMessage };
  if (message.stickerMessage) return { type: "sticker", media: message.stickerMessage };

  return { text: null };
}

module.exports = {
  storeMessage,
  handleMessageRevocation,
  toggleAntidelete,
  togglePrivateForwarding,
  isAntideleteEnabled,
  isPrivateForwardingEnabled,
  ownerPrivateJid,
  formatTimestamp,
  sourceChatName,
  setBotId
};
