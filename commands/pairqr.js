const { jidNormalizedUser } = require("@whiskeysockets/baileys");

module.exports = {
  name: "pairqr",
  description: "Generate a QR code to link a new WhatsApp account to the bot.",
  category: "owner",
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const activeBotJid = sock?.user?.id ? jidNormalizedUser(sock.user.id) : '';
    const senderJid = msg.key.fromMe
      ? activeBotJid
      : jidNormalizedUser(msg.key.participant || msg.key.remoteJid || '');
    const isOwner = Boolean(activeBotJid) && senderJid === activeBotJid;

    if (!isOwner) {
      return sock.sendMessage(jid, { text: "❌ This command is restricted to the bot owner." }, { quoted: msg });
    }

    const phoneNumber = args[0]?.replace(/\D/g, "");
    if (!phoneNumber || phoneNumber.length < 10) {
      return sock.sendMessage(jid, { text: "❌ Please provide a valid phone number with country code.\nExample: `.pairqr 254746844168`" }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: `⏳ Initializing QR Pairing for ${phoneNumber}... Please wait.` }, { quoted: msg });

    try {
      // In V2.4, we can't easily start a QR session from a command because the multi-user manager is in the parent process.
      // However, we can direct the user to the web dashboard which now supports QR.
      const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
        : (process.env.APP_URL || "your-dashboard-url");

      const pairingUrl = `${baseUrl}/pairing.html`;

      const message = `
┏━━━💠 *QR PAIRING PROTOCOL* 💠━━━┓
┃
┃ 📱 *Number:* ${phoneNumber}
┃ 🔗 *Dashboard:* ${pairingUrl}
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
┃
┃ 1️⃣ Open the dashboard link above.
┃ 2️⃣ Select the *PAIR WITH QR* tab.
┃ 3️⃣ Enter your phone number.
┃ 4️⃣ Scan the generated QR code.
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
      `;

      await sock.sendMessage(jid, { text: message }, { quoted: msg });
    } catch (error) {
      await sock.sendMessage(jid, { text: `❌ Error: ${error.message}` }, { quoted: msg });
    }
  }
};
