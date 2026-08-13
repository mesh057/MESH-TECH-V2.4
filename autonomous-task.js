'use strict';

const fs = require('fs');
const path = require('path');
const meshAi = require('./ai');

const stateDir = path.resolve(process.env.MESH_AUTONOMOUS_TASK_STATE_DIR || process.cwd());
const stateFile = path.join(stateDir, 'autonomous-tasks.json');
fs.mkdirSync(stateDir, { recursive: true });

let state = {};
try {
  if (fs.existsSync(stateFile)) state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
} catch {
  state = {};
}

function save() {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function chatTasks(jid) {
  if (!Array.isArray(state[jid])) state[jid] = [];
  return state[jid];
}

function newId() {
  return `T-${Date.now().toString(36).toUpperCase()}`;
}

function isEnabled() {
  return global.meshAutonomousTasksEnabled === true;
}

function setEnabled(enabled) {
  global.meshAutonomousTasksEnabled = enabled;
  return enabled;
}

async function handleAgent({ args = [], isOwner, reply }) {
  const action = String(args[0] || 'status').toLowerCase();
  if (!isOwner) return reply('🚫 *Only the bot owner can control autonomous task mode.*');
  if (action === 'on' || action === 'off') {
    const enabled = setEnabled(action === 'on');
    return reply(`🧠 Autonomous task mode is now *${enabled ? 'ON ✅' : 'OFF ❌'}*. ${enabled ? 'New tasks require approval before execution.' : 'Existing tasks remain paused.'}`);
  }
  return reply(`🧠 *Autonomous task mode:* ${isEnabled() ? 'ON ✅' : 'OFF ❌'}\nUse ".agent on" or ".agent off".\nRead-only research tasks always require approval before execution.`);
}

async function handleTask({ args = [], chatId, isOwner, reply }) {
  if (!isOwner) return reply('🚫 *Only the bot owner can create or control autonomous tasks.*');
  const action = String(args[0] || '').toLowerCase();
  const tasks = chatTasks(chatId);

  if (action === 'approve' || action === 'deny' || action === 'cancel') {
    const task = tasks.find((entry) => entry.id === args[1]);
    if (!task) return reply('⚠️ Task not found. Use `.tasks` to list pending tasks.');
    if (task.status !== 'waiting_approval') return reply(`⚠️ Task *${task.id}* is already ${task.status}.`);
    if (Date.now() > task.expiresAt) {
      task.status = 'expired';
      save();
      return reply(`⌛ Approval for *${task.id}* expired. Create a new task.`);
    }
    if (action === 'deny') {
      task.status = 'denied';
      save();
      return reply(`🛑 Task *${task.id}* denied. No AI execution occurred.`);
    }
    if (action === 'cancel') {
      task.status = 'cancelled';
      save();
      return reply(`⏹️ Task *${task.id}* cancelled.`);
    }
    task.status = 'running';
    task.approvedAt = Date.now();
    save();
    await reply(`✅ Task *${task.id}* approved. MESH AI is executing the read-only research request now.`);
    try {
      await meshAi.run({ args: [task.goal], chatId, sender: chatId, isOwner: true, reply });
      task.status = 'completed';
      task.completedAt = Date.now();
      save();
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Execution failed';
      save();
      return reply(`⚠️ Task *${task.id}* failed safely. No external side effect was attempted.`);
    }
    return;
  }

  if (action === 'list' || action === 'status' || action === 'tasks') {
    const visible = tasks.slice(-10).reverse();
    return reply(visible.length
      ? `🧠 *AUTONOMOUS TASKS*\n${visible.map((task) => `• *${task.id}* — ${task.status}\n  ${task.goal}`).join('\n')}`
      : '🧠 No autonomous tasks exist for this chat.');
  }

  if (!isEnabled()) return reply('⚠️ Autonomous task mode is OFF. The owner must use `.agent on` first.');
  const goal = args.join(' ').trim();
  if (goal.length < 8) return reply('Usage: `.task <goal>`\nExample: `.task compare the latest public information about renewable energy.`');
  const task = {
    id: newId(),
    goal: goal.slice(0, 1000),
    status: 'waiting_approval',
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  tasks.push(task);
  state[chatId] = tasks.slice(-30);
  save();
  return reply(`🧠 *TASK PLAN READY*\n┃ ID: *${task.id}*\n┃ Goal: ${task.goal}\n┃ Scope: read-only MESH AI research\n┃ Approval expires: 10 minutes\n\nUse ".task approve ${task.id}" to execute, or ".task deny ${task.id}" to reject. No execution has happened yet.`);
}

module.exports = { handleAgent, handleTask, isEnabled, setEnabled };
