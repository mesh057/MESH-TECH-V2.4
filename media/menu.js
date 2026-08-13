// Accurate command directory for the lean, restored V2.4 bot.

const header = `
╭━━〔 *MESH TECH MD • V2.4* 〕━━╮
┃ *Working Command Guide*
┃ Mode: use \`.public\` or \`.self\`
╰━━━━━━━━━━━━━━━━━━━━━━╯`;

const commandGuide = `${header}

*GENERAL*
• \`.menu\`, \`.help\`, or \`.commands\` — show this guide
• \`.idcheck\` — show current chat and bot identifiers
• \`.repo\` — show the MESH TECH repository

*MESH AI*
• \`.ai <question>\` — ask MESH AI
• \`.mesh <question>\` or \`.ask <question>\` — MESH AI aliases
• \`.ai status\` — check AI configuration
• \`.chatbot on|off|status\` — owner controls for automatic DM replies

*AUTOMATION — OWNER ONLY*
• \`.autostatus on|off\` — auto-view WhatsApp statuses
• \`.autoviewstatus on|off\` — compatible name for \`.autostatus\`
• \`.autoreact on|off\` — automatic reactions
• \`.autoread on|off\` — automatic message reads
• \`.autorecording on|off\` — show or hide recording presence
• \`.autogreet on|off\` — group join/leave greetings
• \`.antidelete on|off\` — anti-delete control

*GROUP*
• \`.kick @member\` — remove a group participant when the bot has admin permission

> This lean V2.4 guide intentionally lists only the restored handlers currently included in this bot. Commands not shown here are not installed in this version.`;

const automationGuide = `${header}

*AUTOMATION COMMANDS*
• \`.autostatus on|off\` (also \`.autoviewstatus\`)
• \`.autoreact on|off\`
• \`.autoread on|off\`
• \`.autorecording on|off\`
• \`.autogreet on|off\` (group only)
• \`.antidelete on|off\`

All automation controls require the connected bot owner.`;

const aiGuide = `${header}

*MESH AI COMMANDS*
• \`.ai <question>\`
• \`.mesh <question>\`
• \`.ask <question>\`
• \`.ai status\`
• \`.ai reset\`
• \`.chatbot on|off|status\` (owner only)`;

const groupGuide = `${header}

*GROUP COMMANDS*
• \`.kick @member\` — requires bot administrator permission
• \`.autogreet on|off\` — group greetings

Use \`.menu\` for the complete V2.4 guide.`;

module.exports = {
  aimenu: aiGuide,
  automenu: automationGuide,
  groupmenu: groupGuide,
  menu: commandGuide,
  ownermenu: automationGuide,
};
