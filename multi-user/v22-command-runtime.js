'use strict';

const path = require('path');

const engineRoot = path.join(__dirname, '..', 'v22-engine');
const blockedCommands = new Set([
  'eval', 'shell', 'compile-c', 'compile-cpp', 'compile-js', 'compile-py',
  'getfile', 'getcmd', 'bottools', 'update', 'clearcache', 'gpass', 'restart',
  'backup', 'updatenow', 'shutdown',
]);
const catalogArgumentCommands = new Set([
  'help', 'enable', 'disable', 'commandstatus', 'cmdon', 'cmdoff', 'cmdstatus',
]);
const DEFAULT_COMMAND_TIMEOUT_MS = 45_000;

function commandTimeoutMs() {
  const configured = Number.parseInt(process.env.MESH_COMMAND_TIMEOUT_MS || '', 10);
  return Number.isFinite(configured) && configured >= 1_000 && configured <= 120_000
    ? configured
    : DEFAULT_COMMAND_TIMEOUT_MS;
}

async function runWithinTimeout(promise, commandName) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${commandName} timed out while waiting for its provider.`)), commandTimeoutMs());
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

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
        await runWithinTimeout(
          runWithContext(resources, () => command.execute(sock, msg, args, fourthArgument)),
          String(commandName || command.name || 'command'),
        );
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

module.exports = { blockedCommands, catalogArgumentCommands, commandTimeoutMs, createV22CommandRuntime };
