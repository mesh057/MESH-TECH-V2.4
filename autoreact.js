// 📂 File: autoreact.js
// 💖 AutoReact System — MESH TECH MD

const fs = require("fs");
const path = require("path");

const stateDir = path.resolve(process.env.MESH_AUTOREACT_STATE_DIR || process.cwd());
const stateFile = path.join(stateDir, "autoreact.json");

fs.mkdirSync(stateDir, { recursive: true });

let enabled = false;
let statusReactionEnabled = false;
let statusReactionEmoji = "❤️";
try {
  const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  enabled = Boolean(saved.enabled);
  statusReactionEnabled = Boolean(saved.statusReactionEnabled);
  if (typeof saved.statusReactionEmoji === "string" && saved.statusReactionEmoji.trim()) {
    statusReactionEmoji = saved.statusReactionEmoji.trim();
  }
} catch {
  enabled = false;
}

function saveState() {
  fs.writeFileSync(stateFile, JSON.stringify({ enabled, statusReactionEnabled, statusReactionEmoji }, null, 2));
}

function isAutoreactEnabled() {
  return enabled;
}

function getStatusReactionState() {
  return { enabled: statusReactionEnabled, emoji: statusReactionEmoji };
}

async function configureStatusReaction({ args, reply }) {
  const action = (args[0] || "").toLowerCase();

  if (action === "status") {
    return reply(
`╭━━━〔 *✨ STATUS AUTO-REACT* 〕━━━╮
┃ ${statusReactionEnabled ? "✅ Enabled" : "❌ Disabled"}
┃ Emoji: ${statusReactionEmoji}
╰━━━━━━━━━━━━━━━━━━━╯`
    );
  }

  if (action === "emoji") {
    const emoji = args.slice(1).join(" ").trim();
    if (!emoji || [...emoji].length > 12) {
      return reply("Usage: *.autoreactstatus emoji 💜*\nUse one short emoji or emoji sequence.");
    }
    statusReactionEmoji = emoji;
    saveState();
    return reply(`✅ Status reaction emoji saved: ${statusReactionEmoji}`);
  }

  if (!["on", "off"].includes(action)) {
    return reply(
`╭━━━〔 *✨ STATUS AUTO-REACT USAGE* 〕━━━╮
┃ .autoreactstatus on
┃ .autoreactstatus off
┃ .autoreactstatus status
┃ .autoreactstatus emoji 💜
╰━━━━━━━━━━━━━━━━━━━╯`
    );
  }

  statusReactionEnabled = action === "on";
  saveState();
  return reply(`✅ Status auto-react is now *${statusReactionEnabled ? "ENABLED" : "DISABLED"}* with ${statusReactionEmoji}`);
}

// 🧼 Clean number from JID
function getCleanNumber(jid = "") {
  return jid.replace(/\D/g, "");
}

// 🔍 Resolve sender number (works in group & DM)
function resolveSenderNumber(m, conn) {
  let senderJid =
    m.key?.participant ||
    m.message?.extendedTextMessage?.contextInfo?.participant ||
    m.participant ||
    m.sender ||
    (m.key?.fromMe && conn?.user?.id) ||
    m.key?.remoteJid;

  try {
    if (!senderJid && conn?.decodeJid) {
      senderJid = conn.decodeJid(m?.key?.remoteJid);
    }
  } catch {}

  return getCleanNumber(senderJid || "");
}

module.exports = async function ({ conn, m, reply, args, jid }) {
  try {
    const isGroup = jid.endsWith("@g.us");
    const senderNum = resolveSenderNumber(m, conn);
    if (!senderNum) {
      return reply("❌ 𝑼𝒏𝒂𝒃𝒍𝒆 𝒕𝒐 𝒅𝒆𝒕𝒆𝒄𝒕 𝒔𝒆𝒏𝒅𝒆𝒓 𝒏𝒖𝒎𝒃𝒆𝒓.");
    }

    // ⚙️ Toggle AutoReact
    const mode = (args[0] || "").toLowerCase();
    if (mode === "status") {
      return reply(
`╭━━━〔 *💖 AUTO-REACT STATUS* 〕━━━╮
┃ ${enabled ? "✅ 𝑨𝒖𝒕𝒐-𝑹𝒆𝒂𝒄𝒕: *ENABLED*" : "❌ 𝑨𝒖𝒕𝒐-𝑹𝒆𝒂𝒄𝒕: *DISABLED*"}
╰━━━━━━━━━━━━━━━━━━━╯`
      );
    }

    if (!["on", "off"].includes(mode)) {
      return reply(
`╭━━━〔 *💖 AUTO-REACT USAGE* 〕━━━╮
┃ ⚙️ 𝑼𝒔𝒆: 
┃   .autoreact on
┃   .autoreact off
╰━━━━━━━━━━━━━━━━━━━╯`
      );
    }

    enabled = mode === "on";
    global.autoreact = enabled;
    saveState();

    return reply(
`╭━━━〔 *💖 AUTO-REACT STATUS* 〕━━━╮
┃ ${mode === "on" ? "✅ 𝑨𝒖𝒕𝒐-𝑹𝒆𝒂𝒄𝒕: *ENABLED*" : "❌ 𝑨𝒖𝒕𝒐-𝑹𝒆𝒂𝒄𝒕: *DISABLED*"}
┃ 👤 𝑻𝒐𝒈𝒈𝒍𝒆𝒅 𝒃𝒚: +${senderNum}
┃ 💜 𝑷𝒐𝒘𝒆𝒓𝒆𝒅 𝒃𝒚: 𝑻𝒂𝒚𝒚𝒂𝒃 𝑬𝒙𝒑𝒍𝒐𝒊𝒕𝒔
╰━━━━━━━━━━━━━━━━━━━╯`
    );

  } catch (err) {
    console.error("❌ AutoReact Error:", err);
    return reply("💥 𝑺𝒐𝒎𝒆𝒕𝒉𝒊𝒏𝒈 𝒘𝒆𝒏𝒕 𝒘𝒓𝒐𝒏𝒈.");
  }
};

module.exports.isAutoreactEnabled = isAutoreactEnabled;
module.exports.configureStatusReaction = configureStatusReaction;
module.exports.getStatusReactionState = getStatusReactionState;
