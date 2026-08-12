'use strict';

const assert = require('assert');
const meshAi = require('./ai');
const { handleCommand } = require('./menu/case');

const meshEnvKeys = [
  'MESH_AI_ENABLED',
  'MESH_AI_PROVIDER',
  'MESH_AI_NAME',
  'MESH_AI_API_KEY',
  'MESH_AI_MANAGED_BASE_URL',
  'MESH_AI_MANAGED_MODEL',
  'MESH_AI_OLLAMA_BASE_URL',
  'MESH_AI_OLLAMA_MODEL',
  'MESH_AI_SYSTEM_PROMPT',
];

const originalEnv = Object.fromEntries(meshEnvKeys.map((key) => [key, process.env[key]]));
const directChat = '254700000001@s.whatsapp.net';
const groupChat = '12345@g.us';
const sender = '254700000001@s.whatsapp.net';

function restoreEnvironment() {
  for (const key of meshEnvKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

async function invokeAi(args, isOwner = false, chatId = directChat) {
  const replies = [];
  await meshAi.run({
    args,
    chatId,
    sender,
    isGroup: chatId.endsWith('@g.us'),
    isOwner,
    reply: async (message) => replies.push(message),
  });
  return replies.at(-1);
}

async function invokeChatbot(args, chatId = directChat) {
  const replies = [];
  await meshAi.chatbot({
    args,
    chatId,
    sender,
    isGroup: chatId.endsWith('@g.us'),
    reply: async (message) => replies.push(message),
  });
  return replies.at(-1);
}

async function invokeDispatcher(text) {
  const replies = [];
  const conn = {
    user: { id: '254700000099:1@s.whatsapp.net' },
    sendMessage: async (_chatId, payload) => replies.push(payload.text),
  };
  const msg = {
    key: { remoteJid: directChat, participant: sender, fromMe: false },
    message: { conversation: text },
  };
  await handleCommand(conn, msg);
  return replies.at(-1);
}

async function main() {
  try {
    process.env.MESH_AI_ENABLED = 'true';
    process.env.MESH_AI_PROVIDER = 'managed';
    process.env.MESH_AI_NAME = 'MESH AI';
    delete process.env.MESH_AI_API_KEY;
    process.env.MESH_AI_MANAGED_MODEL = 'test-model';
    meshAi.resetRuntimeState({ clearPreferences: true });

    const config = meshAi.getMeshAiConfig();
    assert.equal(config.provider, 'managed');
    assert.equal(config.assistantName, 'MESH AI');
    assert.equal(config.managed.model, 'test-model');
    assert.equal(config.managed.apiKey, '');

    const prompt = meshAi.buildSystemPrompt(config);
    assert(prompt.includes('MESH AI'));
    assert(prompt.includes('Do not claim to be BWM XMD'));

    const help = await invokeAi(['help']);
    assert(help.includes('.ai How do I make a sticker?'));
    assert(help.includes('.chatbot on'));

    const missingConfig = await invokeAi(['Hello', 'MESH', 'AI']);
    assert(missingConfig.includes('not configured yet'));
    assert(!missingConfig.includes('MESH_AI_API_KEY='));

    const originalMode = global.mode;
    global.mode = 'public';
    const defaultState = await invokeChatbot(['status']);
    assert(defaultState.includes('off for this DM'));
    assert.equal(meshAi.isChatbotEnabled(directChat), false);

    const routedChatbot = await invokeDispatcher('.chatbot status');
    assert(routedChatbot.includes('off for this DM'));
    const routedAlias = await invokeDispatcher('.mesh Tell me about MESH AI');
    assert(routedAlias.includes('not configured yet'));
    global.mode = originalMode;

    const enabled = await invokeChatbot(['on']);
    assert(enabled.includes('Chatbot enabled'));
    assert.equal(meshAi.isChatbotEnabled(directChat), true);

    process.env.MESH_AI_API_KEY = 'test-key-only-for-local-eligibility-checks';
    assert.equal(meshAi.autoReplyEnabled({ text: 'Hello', chatId: directChat, isGroup: false, fromMe: false }), true);
    assert.equal(meshAi.autoReplyEnabled({ text: '.menu', chatId: directChat, isGroup: false, fromMe: false }), false);
    assert.equal(meshAi.autoReplyEnabled({ text: 'Hello', chatId: groupChat, isGroup: true, fromMe: false }), false);
    assert.equal(meshAi.autoReplyEnabled({ text: 'Hello', chatId: directChat, isGroup: false, fromMe: true }), false);

    const groupControl = await invokeChatbot(['on'], groupChat);
    assert(groupControl.includes('only in direct messages'));

    const disabled = await invokeChatbot(['off']);
    assert(disabled.includes('Chatbot disabled for this DM'));
    assert.equal(meshAi.isChatbotEnabled(directChat), false);
    assert.equal(meshAi.autoReplyEnabled({ text: 'Hello', chatId: directChat, isGroup: false, fromMe: false }), false);

    const denied = await invokeAi(['off']);
    assert(denied.includes('Only the bot owner'));

    const ownerDisabled = await invokeAi(['off'], true);
    assert(ownerDisabled.includes('now disabled'));
    const blocked = await invokeAi(['Can', 'you', 'help', 'me?']);
    assert(blocked.includes('currently disabled'));
    const ownerEnabled = await invokeAi(['on'], true);
    assert(ownerEnabled.includes('now enabled'));

    const cleared = await invokeAi(['reset']);
    assert(cleared.includes('cleared the saved chat context'));

    assert.equal(meshAi.extractManagedText({ output_text: 'Direct answer' }), 'Direct answer');
    assert.equal(
      meshAi.extractManagedText({ choices: [{ message: { content: 'Chat completion answer' } }] }),
      'Chat completion answer'
    );
    assert.equal(
      meshAi.extractManagedText({ output: [{ content: [{ type: 'output_text', text: 'Responses answer' }] }] }),
      'Responses answer'
    );

    process.env.MESH_AI_PROVIDER = 'ollama';
    process.env.MESH_AI_OLLAMA_MODEL = 'llama3.2:3b';
    const ollamaConfig = meshAi.getMeshAiConfig();
    assert.equal(ollamaConfig.provider, 'ollama');
    assert.equal(ollamaConfig.ollama.model, 'llama3.2:3b');

    console.log('PASS: MESH AI provider settings, DM opt-in controls, and automatic-reply safeguards are working.');
  } finally {
    meshAi.resetRuntimeState({ clearPreferences: true });
    restoreEnvironment();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
