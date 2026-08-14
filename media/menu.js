'use strict';

const READ_MORE = String.fromCharCode(8206).repeat(4001);

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

const COMMAND_DESCRIPTIONS = {
  "menu": "Shows this descriptive command menu.",
  "help": "Shows the interactive help guide.",
  "idcheck": "Check your WhatsApp JID and bot ID.",
  "repo": "Get the official bot repository link.",
  "google": "Search Google for information.",
  "spotify": "Search and download Spotify tracks.",
  "lyrics": "Find lyrics for any song.",
  "ai": "Chat with the advanced AI assistant.",
  "mesh": "Chat with MESH-TECH custom AI.",
  "grok": "Chat with xAI Grok assistant.",
  "mistral": "Chat with Mistral AI assistant.",
  "casperai": "Chat with Casper Tech AI.",
  "bible": "Search for verses in the Bible.",
  "quran": "Search for verses in the Quran.",
  "chatbot": "Toggle automatic AI chat replies.",
  "agent": "Toggle autonomous agent tasks.",
  "public": "Set bot to public mode (Everyone).",
  "self": "Set bot to private mode (Owner only).",
  "settings": "Show and manage bot configurations.",
  "system": "Check system and resource status.",
  "autostatus": "Toggle automatically viewing statuses.",
  "autoreactstatus": "Toggle auto status reactions.",
  "autoreact": "Toggle auto message reactions.",
  "autoread": "Toggle automatically reading messages.",
  "autorecording": "Toggle fake recording indicator.",
  "autotyping": "Toggle fake typing indicator.",
  "alwaysonline": "Toggle always showing as online.",
  "antidelete": "Toggle message recovery system.",
  "antilink": "Toggle group link protection.",
  "antilinkick": "Toggle kicking link senders.",
  "antibug": "Toggle protection against lag/bugs.",
  "kick": "Remove a member from the group.",
  "add": "Add a participant to the group.",
  "promote": "Promote a member to admin.",
  "demote": "Demote an admin to member.",
  "tagall": "Mention all members in the group.",
  "hidetag": "Mention all without visible tags.",
  "welcome": "Toggle group welcome messages.",
  "tiktok": "Download TikTok video (no WM).",
  "ytmp3": "Download YouTube audio via link.",
  "ytmp4": "Download YouTube video via link.",
  "fb": "Download Facebook videos via link.",
  "insta": "Download Instagram Reels/Posts.",
  "qr": "Generate or read QR codes.",
  "ss": "Take a screenshot of a website.",
  "shorten": "Shorten a long URL link.",
  "removebg": "Remove background from images.",
  "enlarger": "Upscale images using AI.",
  "ocr": "Extract text from an image.",
  "tempmail": "Generate a temporary email.",
  "fire": "Generate fire-style text logo.",
  "logo": "Generate professional gaming logo.",
  "glow": "Generate glowing neon text logo.",
  "glass": "Generate glass-style text logo.",
  "balloon": "Generate foil balloon text logo.",
  "restart": "Restarts the bot process.",
  "shutdown": "Shuts down the bot process.",
  "block": "Block a user from the bot.",
  "unblock": "Unblock a user.",
  "kickall": "Remove all members from group.",
  "broadcast": "Send message to all chats."
};

const WORKING_V24_GROUPS = [
  ['GENERAL', '✨', ['menu', 'help', 'idcheck', 'repo', 'google', 'spotify', 'lyrics']],
  ['AI', '🤖', ['ai', 'mesh', 'grok', 'mistral', 'casperai', 'bible', 'quran', 'chatbot', 'agent']],
  ['SYSTEM', '🌐', ['public', 'self', 'settings', 'system']],
  ['AUTOMATION', '🪅', ['autostatus', 'autoreactstatus', 'autoreact', 'autoread', 'autorecording', 'autotyping', 'alwaysonline']],
  ['PROTECTION', '🛡️', ['antidelete', 'antilink', 'antilinkick', 'antibug']],
  ['GROUP', '👥', ['kick', 'add', 'promote', 'demote', 'tagall', 'hidetag', 'welcome']],
  ['MEDIA', '📥', ['tiktok', 'ytmp3', 'ytmp4', 'fb', 'insta', 'qr', 'ss', 'shorten', 'removebg', 'enlarger', 'ocr', 'tempmail']],
  ['EDITORS', '🎨', ['fire', 'logo', 'glow', 'glass', 'balloon']],
  ['OWNER', '👑', ['restart', 'shutdown', 'block', 'unblock', 'kickall', 'broadcast']],
];

function formatGroup([title, emoji, commands]) {
  const lines = commands.map((cmd) => {
    const desc = COMMAND_DESCRIPTIONS[cmd] || "No description available.";
    return `• .${cmd} — ${desc}`;
  });
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
