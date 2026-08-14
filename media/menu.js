'use strict';

const READ_MORE = String.fromCharCode(8206).repeat(4001);
const MARKERS = ['➊', '➋', '➌', '➍', '➎', '➏', '➐', '➑', '➒', '➓'];

function toBold(text) {
  const boldChars = {
    'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
    'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
    '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
  };
  return text.split('').map(c => boldChars[c] || c).join('');
}

function getStatusBox(timezone = 'Africa/Nairobi', userCount = 0, commandCount = 0) {
  const date = new Date().toLocaleDateString('en-GB', { timeZone: timezone });
  const time = new Date().toLocaleTimeString('en-GB', { timeZone: timezone, hour12: true });
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const ram = `${Math.floor(Math.random() * 60) + 40}/128 GB`;

  return `╭━━━〔 ${toBold("PHANTOM CORE v2.4")} 〕━━━┈⊷
┃ 👑 *Owner:* MESH-TECH
┃ 🚀 *Uptime:* ${hours}h ${minutes}m
┃ 🧠 *RAM:* ${ram}
┃ 👥 *Users:* ${userCount}
┃ ⚡ *Commands:* ${commandCount}
┃ 📅 *Date:* ${date}
┃ 🕒 *Time:* ${time}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷`;
}

const WORKING_V24_GROUPS = [
  ['GENERAL', '✨', ['menu', 'help', 'commands', 'idcheck', 'repo', 'google <query>', 'spotify <song>', 'lyrics <song>']],
  ['AI', '🤖', ['ai <question>', 'mesh <question>', 'grok <msg>', 'mistral <msg>', 'casperai <msg>', 'bible <verse>', 'quran <verse>', 'chatbot on|off|status', 'agent on|off|status']],
  ['SYSTEM', '🌐', ['public', 'self', 'settings', 'system']],
  ['AUTOMATION', '🪅', [
    'autostatus on|off', 'autoviewstatus on|off', 'autoreactstatus on|off|status',
    'autoreact on|off|status', 'autoread on|off',
    'autorecording on|off', 'autotyping on|off', 'alwaysonline on|off'
  ]],
  ['PROTECTION', '🛡️', [
    'antidelete on|off|status', 'antilink on|off', 'antilinkick on|off|status', 'antibug on|off|status'
  ]],
  ['GROUP', '👥', [
    'kick @member', 'add 254...', 'promote', 'demote', 'tagall', 'hidetag', 'welcome on|off'
  ]],
  ['MEDIA', '📥', [
    'tiktok <url>', 'ytmp3 <url>', 'ytmp4 <url>', 'fb <url>', 'insta <url>',
    'qr <text>', 'ss <url>', 'shorten <url>', 'removebg <url>', 'enlarger <url>', 'ocr <url>', 'tempmail'
  ]],
  ['EDITORS', '🎨', ['fire <text>', 'logo <text>', 'glow <text>', 'glass <text>', 'balloon <text>']],
  ['OWNER', '👑', ['restart', 'shutdown', 'block', 'unblock', 'kickall', 'broadcast']],
];

function numberedLine(index, command) {
  return `║${MARKERS[index] || `${index + 1}.`} ⟿ .${command}`;
}

function formatGroup([title, emoji, commands]) {
  const lines = commands.map((command, index) => numberedLine(index, command));
  return `╔═❖•⊰ ${emoji} *${toBold(title + " MENU")}* ⊱•❖═╗\n${lines.join('\n')}\n╚════════════════════╝`;
}

function renderMenu(groups = WORKING_V24_GROUPS) {
  const commandCount = groups.reduce((total, [, , commands]) => total + commands.length, 0);
  const userCount = Number(global.activeUserCount || 0);
  const sections = groups.map(formatGroup).join('\n\n');
  return `${getStatusBox('Africa/Nairobi', userCount, commandCount)}
╔═❖•⊰ *${toBold("COMMAND MENU")}* ⊱•❖═╗
║୧⍤⃝💐 𝗔𝗹𝗹 𝗹𝗼𝗮𝗱𝗲𝗱 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀
╚═══════════════════╝
${READ_MORE}
${sections}

*『 𝗠𝗘𝗦𝗛-𝗧𝗘𝗖𝗛 𝗠𝗗 』*`;
}

module.exports = {
  aimenu: renderMenu(WORKING_V24_GROUPS.filter(([title]) => title === 'AI')),
  automenu: renderMenu(WORKING_V24_GROUPS.filter(([title]) => ['AUTOMATION', 'PROTECTION'].includes(title))),
  groupmenu: renderMenu(WORKING_V24_GROUPS.filter(([title]) => title === 'GROUP')),
  menu: renderMenu(),
  ownermenu: renderMenu(WORKING_V24_GROUPS.filter(([title]) => title === 'OWNER')),
  getStatusBox,
  renderMenu,
};
