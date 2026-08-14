'use strict';

let autorecordingScope = 'off'; // p, g, all, off

function isAutorecordingEnabled(isGroup) {
    if (autorecordingScope === 'all' || autorecordingScope === true) return true;
    if (autorecordingScope === 'p' && !isGroup) return true;
    if (autorecordingScope === 'g' && isGroup) return true;
    return false;
}

function configureAutorecording({ args, reply }) {
    const val = args[0]?.toLowerCase();
    if (!val) {
        return reply(`🎙️ *Auto Recording Status:* ${autorecordingScope.toUpperCase()}\nUsage: .autorecording p / g / all / off`);
    }

    if (val === 'on' || val === 'all') {
        autorecordingScope = 'all';
        return reply("✅ *Auto Recording:* ON (ALL CHATS)");
    } else if (val === 'p' || val === 'private') {
        autorecordingScope = 'p';
        return reply("✅ *Auto Recording:* PRIVATE CHATS ONLY (👤)");
    } else if (val === 'g' || val === 'group') {
        autorecordingScope = 'g';
        return reply("✅ *Auto Recording:* GROUPS ONLY (👥)");
    } else if (val === 'off' || val === 'false') {
        autorecordingScope = 'off';
        return reply("❌ *Auto Recording:* OFF");
    } else {
        return reply("❌ Invalid scope. Use: .autorecording p / g / all / off");
    }
}

module.exports = async function ({ conn, m, reply, args }) {
    return configureAutorecording({ args, reply });
};
module.exports.isAutorecordingEnabled = isAutorecordingEnabled;
module.exports.configureAutorecording = configureAutorecording;
