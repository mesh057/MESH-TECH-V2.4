'use strict';

const fs = require('fs-extra');
const path = require('path');

async function sessionCommand({ conn, m, jid, isOwner, reply }) {
    if (!isOwner) {
        return reply('❌ This command is restricted to the bot owner.');
    }

    try {
        const authDir = path.join(__dirname, 'auth_info');
        const credsPath = path.join(authDir, 'creds.json');

        if (!fs.existsSync(credsPath)) {
            return reply('❌ No credentials found to generate a session ID.');
        }

        const creds = fs.readFileSync(credsPath, 'utf-8');
        const base64 = Buffer.from(creds).toString('base64');
        const sessionId = `MESH-TECH;;;${base64}`;

        const text = `╭━━━〔 *SESSION RECOVERY* 〕━━━┈⊷\n` +
                     `┃ 🔑 *Your SESSION_ID is ready!*\n` +
                     `┃ \n` +
                     `┃ 📝 *Instructions:* \n` +
                     `┃ 1. Copy the long message below.\n` +
                     `┃ 2. Go to your Railway Dashboard.\n` +
                     `┃ 3. Add a new variable: \`SESSION_ID\`\n` +
                     `┃ 4. Paste the copied string as the value.\n` +
                     `┃ \n` +
                     `┃ 💡 *Why?* This prevents logouts after updates!\n` +
                     `╰━━━━━━━━━━━━━━━━━━━━━━┈⊷`;

        await reply(text);
        await conn.sendMessage(jid, { text: sessionId }, { quoted: m });

    } catch (error) {
        await reply(`❌ Error generating session: ${error.message}`);
    }
}

module.exports = sessionCommand;
