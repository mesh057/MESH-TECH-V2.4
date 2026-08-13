const fs = require("fs");
const readline = require("readline");
const P = require("pino");
const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  DisconnectReason 
} = require("@whiskeysockets/baileys");

const { handleCommand } = require("./menu/case");
const { loadSettings } = require("./settings");
const { storeMessage, handleMessageRevocation, isAntideleteEnabled, setBotId } = require("./antidelete");
const autoreactControl = require("./autoreact");
const AntiLinkKick = require("./antilinkick.js");
const { antibugHandler } = require("./antibug.js"); // ✅ import correct function
const meshAi = require("./ai");
const { getValue } = require("./system/storage");
const { notifyBotEvent } = require("./multi-user/push-notifier");

function normalizePhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function requestPairingCodeWithRetries(sock, phoneNumber) {
  let lastError = new Error("WhatsApp did not return a pairing code.");
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      // The Baileys socket needs a moment to establish its initial transport on
      // cloud hosts. Subsequent attempts provide a bounded recovery window.
      await wait(1200 * attempt);
      const code = await sock.requestPairingCode(phoneNumber);
      if (code) return code;
      lastError = new Error("WhatsApp returned an empty pairing code.");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Pairing-code attempt ${attempt}/4 failed: ${lastError.message}`);
    }
  }
  throw lastError;
}

async function getPairingPhoneNumber() {
  const fromEnvironment = normalizePhoneNumber(process.env.MESH_PAIRING_PHONE_NUMBER);
  if (fromEnvironment) return fromEnvironment;

  // Railway and other cloud hosts do not provide an interactive terminal. Keep
  // the bot running so the owner can add MESH_PAIRING_PHONE_NUMBER and redeploy.
  if (!process.stdin.isTTY) {
    console.warn("⚠️ WhatsApp is not paired. Set MESH_PAIRING_PHONE_NUMBER in the host environment, then redeploy to print a pairing code.");
    return "";
  }

  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise((resolve) => terminal.question("📱 Enter your WhatsApp number (with country code): ", resolve));
    return normalizePhoneNumber(answer);
  } finally {
    terminal.close();
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({ version, auth: state, logger: P({ level: "fatal" }) });

  const settings = typeof loadSettings === 'function' ? loadSettings() : {};
  const multiUserOwner = normalizePhoneNumber(process.env.MESH_MULTI_USER_SESSION_OWNER);
  const isMultiUserSession = Boolean(multiUserOwner);
  let ownerRaw = multiUserOwner || settings.ownerNumber?.[0] || "92300xxxxxxx";
  const ownerJid = ownerRaw.includes("@s.whatsapp.net") ? ownerRaw : ownerRaw + "@s.whatsapp.net";

  global.sock = sock;
  setBotId(sock);
  global.settings = settings;
  global.signature = settings.signature || "> MESH TECH MD ✓";
  global.owner = ownerJid;
  global.ownerNumber = ownerRaw;
  global.isMultiUserSession = isMultiUserSession;
  // Each user who creates a session through the pairing page owns that session.
  // Multi-user sessions start public so ordinary commands are usable immediately.
  global.mode = isMultiUserSession
    ? (process.env.MESH_MULTI_USER_SESSION_MODE === "self" ? "self" : "public")
    : (getValue("meshBotMode") === "public" ? "public" : "self");

  // ✅ Flags
  global.antilink = {};
  global.antilinkick = {};
  global.antibug = false;
  global.autogreet = {};
  global.autotyping = false;
  global.autoreact = autoreactControl.isAutoreactEnabled();
  global.autostatus = false;

  console.log("✅ BOT OWNER:", global.owner);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {  
      console.log("✅ [BOT ONLINE] Connected to WhatsApp!");  
      void notifyBotEvent({ event: "whatsapp_online", title: "MESH AI bot is online", body: "Your WhatsApp bot is connected and ready to respond." });
    }  

    if (connection === "close") {  
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);  
      console.log("❌ Disconnected. Reconnecting:", shouldReconnect);  
      void notifyBotEvent({
        event: shouldReconnect ? "whatsapp_disconnected" : "whatsapp_logged_out",
        title: shouldReconnect ? "MESH AI bot disconnected" : "MESH AI bot needs attention",
        body: shouldReconnect ? "WhatsApp disconnected. The hosted bot is attempting to reconnect." : "The WhatsApp session was logged out or stopped. Re-pair the bot when you can.",
      });
      if (shouldReconnect) startBot();  
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    const jid = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    // ✅ Per-chat AntiDelete, controlled by `.antidelete on|off|status`.
    try {
      if (msg.message?.protocolMessage?.type === 0) {
        await handleMessageRevocation(sock, msg);
        return;
      }
      if (isAntideleteEnabled(jid)) storeMessage(msg);
    } catch (err) {
      console.error("❌ AntiDelete Error:", err.message);
    }

    // ✅ AutoTyping
    if (global.autotyping && jid !== "status@broadcast") {  
      try {  
        await sock.sendPresenceUpdate('composing', jid);  
        await new Promise(res => setTimeout(res, 2000));  
      } catch (err) {  
        console.error("❌ AutoTyping Error:", err.message);  
      }  
    }  

    // ✅ AutoReact
    if (global.autoreact && jid !== "status@broadcast") {
      try {
        const hearts = [
          "❤️","☣️","🅣","🧡","💛","💚","💙","💜",
          "🖤","🤍","🤎","💕","💞","💓",
          "💗","💖","💘","💝","🇵🇰","♥️"
        ];
        const randomHeart = hearts[Math.floor(Math.random() * hearts.length)];
        await sock.sendMessage(jid, { react: { text: randomHeart, key: msg.key } });
      } catch (err) {
        console.error("❌ AutoReact Error:", err.message);
      }
    }  

    // ✅ AutoStatus View
    if (global.autostatus && jid === "status@broadcast") {  
      try {  
        await sock.readMessages([{  
          remoteJid: jid,  
          id: msg.key.id,  
          participant: msg.key.participant || msg.participant  
        }]);  
        console.log(`👁️ Status Seen: ${msg.key.participant || "Unknown"}`);  
      } catch (err) {  
        console.error("❌ AutoStatus View Error:", err.message);  
      }  
      return;  
    }  

    // ✅ Antilink
    if (
      jid.endsWith("@g.us") &&
      global.antilink[jid] === true &&
      /(chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me|bit\.ly|youtu\.be|https?:\/\/)/i.test(text) &&
      !msg.key.fromMe
    ) {
      try {
        await sock.sendMessage(jid, {  
          delete: { remoteJid: jid, fromMe: false, id: msg.key.id, participant: msg.key.participant || msg.participant }  
        });  
        
      } catch (err) {
        console.error("❌ Antilink Delete Error:", err.message);
      }
    }

    // ✅ AntilinkKick
    if (
      jid.endsWith("@g.us") &&
      global.antilinkick[jid] === true &&
      /(chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me|bit\.ly|youtu\.be|https?:\/\/)/i.test(text) &&
      !msg.key.fromMe
    ) {
      try {
        await AntiLinkKick.checkAntilinkKick({ conn: sock, m: msg });
        
      } catch (err) {
        console.error("❌ AntilinkKick Error:", err.message || err);
      }
    }

    // ✅ AntiBug
    if (global.antibug === true && !msg.key.fromMe) {
      try {
        const isBug = await antibugHandler({ conn: sock, m: msg }); // ✅ FIX
        if (isBug) {
          
          return;
        }
      } catch (err) {
        console.error("❌ AntiBug Error:", err.message || err);
      }
    }

    // ✅ Command handler
    try {  
      await handleCommand(sock, msg, {});  
    } catch (err) {  
      console.error("❌ Command error:", err.message || err);  
    }

    // ✅ MESH AI automatic direct-message replies
    // The owner enables the global chatbot with `.chatbot on`. Automatic replies
    // are never sent in groups, status broadcasts, bot-authored messages, or self mode.
    if (getValue("meshBotMode") === "public") {
      try {
        await meshAi.autoReply({
          text,
          chatId: jid,
          sender: msg.key.participant || msg.key.remoteJid,
          isGroup: jid.endsWith("@g.us"),
          fromMe: msg.key.fromMe,
          reply: (replyText) => sock.sendMessage(jid, { text: replyText }, { quoted: msg })
        });
      } catch (err) {
        console.error("❌ MESH AI automatic reply error:", err.message || err);
      }
    }
  });

  // ✅ AutoGreet
  sock.ev.on("group-participants.update", async (update) => {
    const { id, participants, action } = update;
    if (!global.autogreet?.[id]) return;

    try {
      const metadata = await sock.groupMetadata(id);
      const memberCount = metadata.participants.length;
      const groupName = metadata.subject || "Unnamed Group";
      const groupDesc = metadata.desc?.toString() || "No description set.";

      for (const user of participants) {
        const tag = `@${user.split("@")[0]}`;
        let message = "";

        if (action === "add") {
          message = `
┏━━━🔥༺ 𓆩💀𓆪 ༻🔥━━━┓
   💠 *WELCOME TO MESH TECH* 💠
┗━━━🔥༺ 𓆩💀𓆪 ༻🔥━━━┛

👹 *Hey ${tag}, Welcome to*  
『 ${groupName} 』

⚡ *Current Members:* ${memberCount}  
📜 *Group Description:*  
『 ${groupDesc} 』

💀 *Attitude ON, Rules OFF*  
👾 *MESH TECH MD welcomes you with POWER* ⚡
          `;
        } else if (action === "remove") {
          message = `
┏━━━💔༺ 𓆩☠️𓆪 ༻💔━━━┓
   ❌ *GOODBYE WARRIOR* ❌
┗━━━💔༺ 𓆩☠️𓆪 ༻💔━━━┛

💔 ${tag} *has left the battlefield...*  
⚡ *Now only ${memberCount - 1} members remain in ${groupName}*  
☠️ *MESH TECH keeps it active...*  
          `;
        }

        if (message) {
          await sock.sendMessage(id, { text: message, mentions: [user] });
        }
      }
    } catch (err) {
      console.error("❌ AutoGreet Error:", err.message);
    }
  });

  // ✅ Pairing code
  if (!state.creds?.registered) {
    const phoneNumber = await getPairingPhoneNumber();
    if (!phoneNumber) return;

    try {
      const code = await requestPairingCodeWithRetries(sock, phoneNumber);
      console.log("\n🔗 Pair this device using this code in WhatsApp:\n");
      console.log("   " + code + "\n");
      // Machine-readable marker for the multi-user pairing server. Keep this
      // separate from prose so normal words are never mistaken for a code.
      console.log(`PAIRING_CODE ${code}`);
      console.log("Go to WhatsApp → Linked Devices → Link with code.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("❌ Could not request WhatsApp pairing code:", message);
      console.error(`PAIRING_ERROR ${message}`);
    }
  }
}

startBot();
