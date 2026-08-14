'use strict';

let autotypingScope = 'off'; // p, g, all, off

function isAutotypingEnabled(isGroup) {
    if (autotypingScope === 'all' || autotypingScope === true) return true;
    if (autotypingScope === 'p' && !isGroup) return true;
    if (autotypingScope === 'g' && isGroup) return true;
    return false;
}

function configureAutotyping({ args, reply }) {
    const val = args[0]?.toLowerCase();
    if (!val) {
        return reply(`🤖 *Auto Typing Status:* ${autotypingScope.toUpperCase()}\nUsage: .autotyping p / g / all / off`);
    }

    if (val === 'on' || val === 'all') {
        autotypingScope = 'all';
        return reply("✅ *Auto Typing:* ON (ALL CHATS)");
    } else if (val === 'p' || val === 'private') {
        autotypingScope = 'p';
        return reply("✅ *Auto Typing:* PRIVATE CHATS ONLY (👤)");
    } else if (val === 'g' || val === 'group') {
        autotypingScope = 'g';
        return reply("✅ *Auto Typing:* GROUPS ONLY (👥)");
    } else if (val === 'off' || val === 'false') {
        autotypingScope = 'off';
        return reply("❌ *Auto Typing:* OFF");
    } else {
        return reply("❌ Invalid scope. Use: .autotyping p / g / all / off");
    }
}

module.exports = {
    isAutotypingEnabled,
    configureAutotyping,
    run: configureAutotyping
};
