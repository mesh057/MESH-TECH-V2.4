'use strict';

const path = require('path');

const engineRoot = path.join(__dirname, '..', 'v22-engine');
const blockedCommands = new Set([
  'eval', 'shell', 'compile-c', 'compile-cpp', 'compile-js', 'compile-py',
  'getfile', 'getcmd', 'bottools', 'update', 'clearcache', 'gpass', 'restart',
]);

function sessionLogger(ownerNumber) {
  const prefix = `[v22-runtime:${ownerNumber}]`;
  return {
    info: (...items) => console.log(prefix, ...items),
    warn: (...items) => console.warn(prefix, ...items),
    error: (...items) => console.error(prefix, ...items),
    debug: (...items) => console.debug(prefix, ...items),
    child: () => sessionLogger(ownerNumber),
  };
}

async function createV22CommandRuntime({ sessionDir, ownerNumber }) {
  const { loadCommands } = require(path.join(engineRoot, 'utils', 'commandLoader'));
  const SettingsStore = require(path.join(engineRoot, 'utils', 'settingsStore'));
  const GroupSettingsStore = require(path.join(engineRoot, 'utils', 'groupSettingsStore'));
  const CommandToggle = require(path.join(engineRoot, 'utils', 'commandToggle'));
  const { runWithContext } = require(path.join(engineRoot, 'utils', 'context'));

  const dataDir = path.join(sessionDir, 'v22-command-data');
  const settings = new SettingsStore(dataDir, ownerNumber);
  const groupSettings = new GroupSettingsStore(dataDir, ownerNumber);
  await Promise.all([settings.ready, groupSettings.ready]);

  const commands = loadCommands(path.join(engineRoot, 'commands'));
  for (const [key, command] of commands) {
    if (blockedCommands.has(key) || blockedCommands.has(String(command?.name || '').toLowerCase())) {
      commands.delete(key);
    }
  }

  const resources = {
    settings,
    groupSettings,
    commandToggle: new CommandToggle(settings),
    commands,
    menuState: new Map(),
    logger: sessionLogger(ownerNumber),
    activeTracker: null,
    messageCache: null,
    presenceManager: null,
  };

  return {
    commands,
    resources,
    async execute(commandName, sock, msg, args) {
      const command = commands.get(String(commandName || '').toLowerCase());
      if (!command) return { handled: false };
      if (resources.commandToggle.isDisabled(commandName)) {
        await sock.sendMessage(msg.key.remoteJid, { text: `❌ Command *${commandName}* is currently disabled.` }, { quoted: msg });
        return { handled: true };
      }
      await runWithContext(resources, () => command.execute(sock, msg, args, resources));
      return { handled: true };
    },
  };
}

module.exports = { blockedCommands, createV22CommandRuntime };
