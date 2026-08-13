'use strict';

const path = require('path');

const engineRoot = path.join(__dirname, '..', 'v22-engine');
const blockedCommands = new Set([
  'eval', 'shell', 'compile-c', 'compile-cpp', 'compile-js', 'compile-py',
  'getfile', 'getcmd', 'bottools', 'update', 'clearcache', 'gpass', 'restart',
]);
const catalogArgumentCommands = new Set([
  'help', 'enable', 'disable', 'commandstatus', 'cmdon', 'cmdoff', 'cmdstatus',
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
      const fourthArgument = catalogArgumentCommands.has(String(commandName || '').toLowerCase())
        || catalogArgumentCommands.has(String(command.name || '').toLowerCase())
        ? commands
        : resources;
      try {
        await runWithContext(resources, () => command.execute(sock, msg, args, fourthArgument));
      } catch (error) {
        resources.logger.error(`Command .${commandName} failed:`, error?.stack || error?.message || error);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ *${commandName}* could not complete right now. If this command uses an online service, its provider may be unavailable. Please try again shortly.`,
        }, { quoted: msg });
      }
      return { handled: true };
    },
  };
}

module.exports = { blockedCommands, catalogArgumentCommands, createV22CommandRuntime };
