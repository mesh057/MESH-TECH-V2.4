const fs = require("fs");
const readline = require("readline");
const P = require("pino");
const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  DisconnectReason,
  jidNormalizedUser
} = require("@whiskeysockets/baileys");

const { handleCommand } = require("./menu/case");
const { loadSettings } = require("./settings");
const { storeMessage, handleMessageRevocation, isAntideleteEnabled, setBotId } = require("./antidelete");
const autoreactControl = require("./autoreact");
const AntiLinkKick = require("./antilinkkick");
const antiBug = require("./antibug");
const meshAi = require("./ai");
const { getValue } = require("./system/storage");
const { notifyBotEvent } = require("./multi-user/push-notifier");
const { bootstrapSession } = require("./sessionBootstrap");

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

const fsExtra = require('fs-extra');
const path = require('path');

// ✅ Instance Locking & PID Check to prevent ghost processes
const sessionID = process.env.MESH_PAIRING_PHONE_NUMBER || 'main';
const LOCK_FILE = path.join(__dirname, 'tmp', `bot-${sessionID}.lock`);
fsExtra.ensureDirSync(path.join(__dirname, 'tmp'));

async function acquireLock() {
  const maxRetries = 5;
  const retryDelay = 2000;

  for (let i = 0; i < maxRetries; i++) {
    if (fsExtra.existsSync(LOCK_FILE)) {
      const oldPid = parseInt(fsExtra.readFileSync(LOCK_FILE, 'utf8').trim());
      if (oldPid === process.pid) return;

      try {
        process.kill(oldPid, 0);
        console.log(`[System] ⏳ Old instance (PID ${oldPid}) is still shutting down... (Attempt ${i + 1}/${maxRetries})`);
        await wait(retryDelay);
      } catch (e) {
        console.warn(`[System] ⚠️ Stale lock found (PID ${oldPid}). Cleaning up.`);
        try { fsExtra.unlinkSync(LOCK_FILE); } catch (err) {}
        break;
      }
    } else {
      break;
    }
  }

  if (fsExtra.existsSync(LOCK_FILE)) {
    const oldPid = parseInt(fsExtra.readFileSync(LOCK_FILE, 'utf8').trim());
    try {
      process.kill(oldPid, 0);
      console.error(`[System] ❌ Another instance of V2.4 is still running (PID ${oldPid}). Exiting.`);
      process.exit(1);
    } catch (e) {}
  }

  try {
    fsExtra.writeFileSync(LOCK_FILE, process.pid.toString());
    console.log(`[System] ✅ Lock acquired (PID ${process.pid})`);
  } catch (e) {
    console.error('[System] ❌ Failed to write lock file:', e.message);
  }
}

function releaseLock() {
  try {
    if (fsExtra.existsSync(LOCK_FILE)) {
      const pid = parseInt(fsExtra.readFileSync(LOCK_FILE, 'utf8').trim());
      if (pid === process.pid) fsExtra.unlinkSync(LOCK_FILE);
    }
  } catch (e) {}
}

// Wrap startup in async to await lock
(async () => {
  await acquireLock();
  await startBot();
})();

// ✅ Graceful shutdown handlers for zero-downtime updates (VPS / Railway)
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
  process.on(signal, () => {
    console.log(`[System] Received ${signal}. Shutting down gracefully...`);
    releaseLock();
    process.exit(0);
  });
});

let isConnecting = false;
let watchdogTimer = null;

async function startBot() {
  if (isConnecting) return;
  isConnecting = true;

  if (watchdogTimer) clearTimeout(watchdogTimer);
  watchdogTimer = setTimeout(() => {
    if (isConnecting) {
      console.warn("[System] Connection watchdog triggered. Forcing restart...");
      if (global.sock) {
        try { global.sock.end(undefined); } catch (_) {}
        global.sock = null;
      }
      isConnecting = false;
      startBot();
    }
  }, 60000); // 1 minute watchdog

  try {
    const authDir = "auth_info";
    const sessionId = process.env.SESSION_ID;
    if (sessionId) {
      await bootstrapSession(sessionId, path.join(__dirname, authDir));
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({ 
      version, 
      auth: state, 
      logger: P({ level: "fatal" }),
      browser: ["Ubuntu", "Chrome", "130.0.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
      generateHighQualityLinkPreview: true
    });

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
    global.mode = isMultiUserSession
      ? (process.env.MESH_MULTI_USER_SESSION_MODE === "self" ? "self" : "public")
      : (getValue("meshBotMode") === "public" ? "public" : "self");

    global.antilink = {};
    global.antilinkick = {};
    global.autogreet = {};
    global.autotyping = false;
    global.autoreact = autoreactControl.isAutoreactEnabled();
    global.autostatus = false;

    console.log("✅ BOT OWNER:", global.owner);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && process.env.MESH_PAIRING_MODE === "qr") {
        console.log(`PAIRING_QR ${qr}`);
      }

      if (connection === "open") {  
        console.log("✅ [BOT ONLINE] Connected to WhatsApp!");  
        isConnecting = false;
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
        void notifyBotEvent({ event: "whatsapp_online", title: "MESH AI bot is online", body: "Your WhatsApp bot is connected and ready to respond." });

        // ✅ BWM XMD Style Progressive Countdown & Status Edited Session Delivery
        setTimeout(async () => {
            try {
                const credsPath = path.join(__dirname, "auth_info", "creds.json");
                if (fsExtra.existsSync(credsPath)) {
                    const ownerJid = jidNormalizedUser(sock.user.id);
                    
                    // Send initial countdown message
                    const initialMsg = await sock.sendMessage(ownerJid, { text: '🔄 *Generating Session ID...*\n⏳ Step 1/10: Initializing secure storage...' }).catch(() => null);
                    const key = initialMsg?.key;

                    for (let i = 2; i <= 10; i++) {
                        await new Promise(r => setTimeout(r, 800)); // Slightly slower for better stability
                        const percentage = i * 10;
                        let stepText = `🔄 *Generating Session ID...*\n⏳ Step ${i}/10: Syncing credentials (${percentage}%)...`;
                        if (i === 10) stepText = `✅ *Session Generated Successfully!*`;
                        
                        if (key) {
                            await sock.sendMessage(ownerJid, { text: stepText, edit: key }).catch(() => {
                                // Fallback if edit fails
                                return sock.sendMessage(ownerJid, { text: stepText }).catch(() => null);
                            });
                        }
                    }

                    // Final stabilization wait
                    await new Promise(r => setTimeout(r, 1000));
                    
                    const creds = fsExtra.readFileSync(credsPath, "utf-8");
                    const base64 = Buffer.from(creds).toString("base64");
                    const sessionId = `MESH-TECH;;;${base64}`;
                    const notice = `╭━━━〔 *MESH-TECH CLOUD SESSION* 〕━━━┈⊷\n` +
                                   `┃ ✅ *Connection Stabilized!*\n` +
                                   `┃ \n` +
                                   `┃ 🔑 *Your SESSION_ID:* \n` +
                                   `╰━━━━━━━━━━━━━━━━━━━━━━┈⊷`;
                    await sock.sendMessage(ownerJid, { text: notice }).catch(() => null);
                    await sock.sendMessage(ownerJid, { text: sessionId }).catch(() => null);
                }
            } catch (e) {
                console.error("❌ Progressive session delivery failed:", e.message);
            }
        }, 3000); // Start earlier but move slower
      }  

      if (connection === "close") {  
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = (statusCode !== DisconnectReason.loggedOut);  
        console.log(`❌ Disconnected (Status: ${statusCode}). Reconnecting: ${shouldReconnect}`);  
        
        isConnecting = false;
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
        void notifyBotEvent({
          event: shouldReconnect ? "whatsapp_disconnected" : "whatsapp_logged_out",
          title: shouldReconnect ? "MESH AI bot disconnected" : "MESH AI bot needs attention",
          body: shouldReconnect ? "WhatsApp disconnected. The hosted bot is attempting to reconnect." : "The WhatsApp session was logged out or stopped. Re-pair the bot when you can.",
        });

        if (shouldReconnect) {
          // Remove all listeners to prevent memory leaks and duplicate responses
          sock.ev.removeAllListeners();
          setTimeout(() => startBot(), 3000);
        }
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

    // ✅ AutoTyping (Non-blocking)
    if (global.autotyping && jid !== "status@broadcast") {  
      // Optimization: Do not await presence updates to avoid blocking the message loop
      sock.sendPresenceUpdate('composing', jid).catch(err => console.error("❌ AutoTyping Error:", err.message));
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
    if (jid === "status@broadcast" && autoreactControl.getStatusReactionState().enabled) {
      try {
        const statusAuthor = msg.key.participant || msg.participant;
        const botJid = jidNormalizedUser(sock.user.id);
        if (statusAuthor) {
          const statusJidList = [jidNormalizedUser(statusAuthor), botJid];
          await sock.sendMessage("status@broadcast", {
            react: { text: autoreactControl.getStatusReactionState().emoji, key: msg.key }
          }, { statusJidList });
        }
      } catch (err) {
        if (!err.message.includes('not-acceptable')) {
          console.error("❌ Status AutoReact Error:", err.message);
        }
      }
    }

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
      AntiLinkKick.isAntilinkKickEnabled(jid) &&
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
    if (!msg.key.fromMe) {
      try {
        const isBug = await antiBug.antibugHandler({ conn: sock, m: msg });
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

  // ✅ Pairing logic
  if (!state.creds?.registered) {
    const phoneNumber = await getPairingPhoneNumber();
    if (!phoneNumber) return;

    if (process.env.MESH_PAIRING_MODE === "qr") {
      console.log("📡 QR Mode Active. Waiting for QR code generation...");
    } else {
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
} catch (error) {
  console.error("❌ Critical error in startBot:", error);
  isConnecting = false;
  setTimeout(() => startBot(), 5000);
}
}

startBot();
