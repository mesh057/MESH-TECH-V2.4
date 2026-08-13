'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-autonomous-task-'));
process.env.MESH_AUTONOMOUS_TASK_STATE_DIR = stateDir;
const autonomousTasks = require('./autonomous-task');

async function main() {
  const replies = [];
  const reply = async (text) => replies.push(String(text));
  global.meshAutonomousTasksEnabled = false;
  const chatId = 'autonomous-test@g.us';

  await autonomousTasks.handleAgent({ args: ['on'], isOwner: true, reply });
  assert.strictEqual(autonomousTasks.isEnabled(), true, 'Owner must be able to enable autonomous mode.');

  await autonomousTasks.handleTask({ args: ['research', 'the latest public renewable energy trends'], chatId, isOwner: true, reply });
  const planReply = replies.at(-1);
  const id = /ID: \*([^*]+)\*/.exec(planReply)?.[1];
  assert.ok(id, 'Creating a task must return a task ID and approval prompt.');
  assert.match(planReply, /No execution has happened yet/);

  await autonomousTasks.handleTask({ args: ['list'], chatId, isOwner: true, reply });
  assert.match(replies.at(-1), new RegExp(id));
  assert.match(replies.at(-1), /waiting_approval/);

  await autonomousTasks.handleTask({ args: ['deny', id], chatId, isOwner: true, reply });
  assert.match(replies.at(-1), /denied/i);

  await autonomousTasks.handleTask({ args: ['approve', id], chatId, isOwner: true, reply });
  assert.match(replies.at(-1), /already denied/i);
  console.log('PASS: Autonomous task mode requires owner control and explicit approval before read-only execution.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
