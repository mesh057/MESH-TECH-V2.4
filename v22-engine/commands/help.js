'use strict';

const config = require('../config/config');
const { isDisabled } = require('../utils/commandToggle');

const MAX_HELP_MESSAGE_LENGTH = 3400;
const FALLBACK_DESCRIPTION = 'No description available.';

function getCanonicalCommands(commands) {
  return [...new Map(
    [...commands.values()]
      .filter((command) => command?.name)
      .map((command) => [String(command.name).toLowerCase(), command])
  ).values()].sort((left, right) => left.name.localeCompare(right.name));
}

function getCategory(command) {
  const category = String(command.category || 'GENERAL').trim();
  return category ? category.toUpperCase() : 'GENERAL';
}

function getBriefDescription(command) {
  const description = String(command.description || FALLBACK_DESCRIPTION)
    .replace(/\s+/g, ' ')
    .trim();

  return description.length > 140 ? `${description.slice(0, 137)}...` : description;
}

function splitIntoMessages(header, lines) {
  const messages = [];
  let current = header;

  for (const line of lines) {
    const separator = current.endsWith('\n') ? '' : '\n';
    const next = `${current}${separator}${line}\n`;

    if (next.length > MAX_HELP_MESSAGE_LENGTH && current.trim()) {
      messages.push(current.trim());
      current = `📚 *${config.botName} — Available Commands (continued)*\n\n${line}\n`;
      continue;
    }

    current = next;
  }

  if (current.trim()) messages.push(current.trim());
  return messages;
}

function buildHelpMessages(commands) {
  const canonicalCommands = getCanonicalCommands(commands);
  const groups = new Map();

  for (const command of canonicalCommands) {
    const category = getCategory(command);
    const group = groups.get(category) || [];
    group.push(command);
    groups.set(category, group);
  }

  const enabledCount = canonicalCommands.filter((command) => !isDisabled(command.name)).length;
  const disabledCount = canonicalCommands.length - enabledCount;
  const lines = [];

  for (const [category, group] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`*${category}* (${group.length})`);
    for (const command of group) {
      const status = isDisabled(command.name) ? ' [OFF]' : '';
      lines.push(`• ${config.prefix}${command.name}${status} — ${getBriefDescription(command)}`);
    }
    lines.push('');
  }

  lines.push(`*Owner tools:* ${config.prefix}enable <command> | ${config.prefix}disable <command> | ${config.prefix}commandstatus`);

  const header = `📚 *${config.botName} — Available Commands*\n\nLoaded: ${canonicalCommands.length} | Enabled: ${enabledCount} | Disabled: ${disabledCount}\nDescriptions and availability are generated from this session's active command catalog.\n`;
  return splitIntoMessages(header, lines);
}

module.exports = {
  name: 'help',
  description: 'Lists loaded commands with brief descriptions.',

  /**
   * @param {object} sock - active Baileys socket connection
   * @param {object} msg - raw incoming message object
   * @param {string[]} args - extra words typed after the command (unused)
   * @param {Map<string, object>} commands - all loaded commands, injected by the dispatcher
   */
  async execute(sock, msg, args, commands) {
    const jid = msg.key.remoteJid;
    const messages = buildHelpMessages(commands);

    for (const text of messages) {
      await sock.sendMessage(jid, { text }, { quoted: msg });
    }
  },
};
