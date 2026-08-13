'use strict';

// Preserved V2.2 drop-down presentation. Only the restored V2.4 command
// inventory below is changed; the box, marker, and category decorations stay
// in the V2.2 format.
const READ_MORE = '';

function getDateTime(timezone = 'Africa/Nairobi') {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(now).toUpperCase();
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', hour12: false,
  }).format(now));
  let greeting = '🌙 Good Night';
  if (hour >= 5 && hour < 12) greeting = '🌅 Good Morning';
  else if (hour >= 12 && hour < 17) greeting = '☀️ Good Afternoon';
  else if (hour >= 17 && hour < 21) greeting = '🌆 Good Evening';
  return { date, time, greeting };
}

function ownerNumber() {
  const owner = Array.isArray(global.owner) ? global.owner[0] : global.owner;
  return String(owner || global.ownerNumber || 'Not linked').replace(/@s\.whatsapp\.net$/, '');
}

function getStatusBox(timezone = 'Africa/Nairobi', userCount = 0, commandCount = 0) {
  const { date, time, greeting } = getDateTime(timezone);
  const uptimeSec = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;
  return `
╭━━━ *𝗠𝗘𝗦𝗛-𝗧𝗘𝗖𝗛 𝗠𝗗 𝗕𝗢𝗧* ━━━╮
┃ ${greeting}
┃ 🔥 𝗠𝗼𝗱𝗲: ${String(global.mode || 'public').toUpperCase()}|FULL POWER
┃ 💀 𝗣𝗿𝗼𝘁𝗼𝗰𝗼𝗹: PHANTOM CORE
┃ 👑 𝗢𝘄𝗻𝗲𝗿: 𝕄𝔼𝕊ℍ
┃ 📞 𝗡𝘂𝗺𝗯𝗲𝗿: ${ownerNumber()}
┃ ⚙️ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: v2.4 [RESTORED CORE]
┃ ⏳ 𝗨𝗽𝘁𝗶𝗺𝗲: ${hours}h ${minutes}m ${seconds}s
┃ 📅 𝗗𝗮𝘁𝗲: ${date}
┃ 🕒 𝗧𝗶𝗺𝗲: ${time}
┃ 📌 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀: ${commandCount} 𝗟𝗼𝗮𝗱𝗲𝗱
┃ 👥 𝗨𝘀𝗲𝗿𝘀: ${userCount} Active (𝗿𝗲𝗮𝗹-𝘁𝗶𝗺𝗲)
┃ 🤖 𝗕𝗼𝘁𝘀 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱: 1 𝗟𝗶𝘃𝗲
┃ 📱 𝗗𝗲𝘃𝗶𝗰𝗲: ANDROID-CORE
╰━━━━━━━━━━━━━━━━━━╯
`;
}

const MARKERS = ['➊', '➋', '➌', '➍', '➎', '➏', '➐', '➑', '➒', '➓'];

const WORKING_V24_GROUPS = [
  ['GENERAL', '✨', ['menu', 'help', 'commands', 'idcheck', 'repo']],
  ['AI', '🤖', ['ai <question>', 'mesh <question>', 'ask <question>', 'chatbot on|off|status']],
  ['SYSTEM', '🌐', ['public', 'self', 'settings']],
  ['AUTOMATION', '🪅', [
    'autostatus on|off', 'autoviewstatus on|off', 'autoreactstatus on|off|status',
    'autoreactstatus emoji 💜', 'autoreact on|off|status', 'autoread on|off',
    'autorecording on|off', 'autotyping on|off', 'autogreet on|off',
  ]],
  ['PROTECTION', '🛡️', [
    'antidelete on|off|status', 'antideleteforward on|off|status',
    'antilink on|off', 'antilinkick on|off|status', 'antibug on|off|status',
  ]],
  ['GROUP', '👥', [
    'kick @member', 'autogreet on|off', 'antilink on|off',
    'antilinkkick on|off|status', 'antilinkkick warning <message>',
    'antilinkkick strikes 3|clear',
  ]],
];

function numberedLine(index, command) {
  return `║${MARKERS[index] || `${index + 1}.`} ⟿ .${command}`;
}

function formatGroup([title, emoji, commands]) {
  const lines = commands.map((command, index) => numberedLine(index, command));
  return `╔═❖•⊰ ${emoji} *${title} MENU* ⊱•❖═╗\n${lines.join('\n')}\n╚════════════════════╝`;
}

function renderMenu(groups = WORKING_V24_GROUPS) {
  const commandCount = groups.reduce((total, [, , commands]) => total + commands.length, 0);
  const userCount = Number(global.activeUserCount || 0);
  const sections = groups.map(formatGroup).join('\n\n');
  return `${getStatusBox('Africa/Nairobi', userCount, commandCount)}
╔═❖•⊰ *𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗠𝗘𝗡𝗨* ⊱•❖═╗
║୧⍤⃝💐 𝗔𝗹𝗹 𝗹𝗼𝗮𝗱𝗲𝗱 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀
╚═══════════════════╝
${READ_MORE}
${sections}

*『 𝗠𝗘𝗦𝗛-𝗧𝗘𝗖𝗛 𝗠𝗗 』*`;
}

const commandGuide = renderMenu();
const automationGuide = renderMenu(WORKING_V24_GROUPS.filter(([title]) => ['AUTOMATION', 'PROTECTION'].includes(title)));
const aiGuide = renderMenu(WORKING_V24_GROUPS.filter(([title]) => title === 'AI'));
const groupGuide = renderMenu(WORKING_V24_GROUPS.filter(([title]) => title === 'GROUP'));

module.exports = {
  aimenu: aiGuide,
  automenu: automationGuide,
  groupmenu: groupGuide,
  menu: commandGuide,
  ownermenu: automationGuide,
  getStatusBox,
  renderMenu,
};
