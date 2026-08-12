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
  'MESH_AI_WEB_SEARCH_MODE',
  'MESH_AI_TAVILY_API_KEY',
  'MESH_AI_TAVILY_BASE_URL',
  'MESH_AI_TAVILY_SEARCH_DEPTH',
  'MESH_AI_TAVILY_MAX_RESULTS',
];

const originalEnv = Object.fromEntries(meshEnvKeys.map((key) => [key, process.env[key]]));
const originalMode = global.mode;
const originalOwners = global.owner;
const directChat = '254700000001@s.whatsapp.net';
const anotherDirectChat = '254700000002@s.whatsapp.net';
const groupChat = '12345@g.us';
const ownerSender = '254700000001@s.whatsapp.net';
const regularSender = '254700000002@s.whatsapp.net';

function restoreEnvironment() {
  for (const key of meshEnvKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

async function invokeAi(args, isOwner = false, chatId = directChat, sender = ownerSender) {
  const replies = [];
  await meshAi.run({
    args,
    chatId,
    sender,
    isOwner,
    reply: async (message) => replies.push(message),
  });
  return replies.at(-1);
}

async function invokeChatbot(args, isOwner = false) {
  const replies = [];
  await meshAi.chatbot({
    args,
    isOwner,
    reply: async (message) => replies.push(message),
  });
  return replies.at(-1);
}

async function invokeDispatcher(text, sender = regularSender) {
  const replies = [];
  const conn = {
    user: { id: '254700000099:1@s.whatsapp.net' },
    sendMessage: async (_chatId, payload) => replies.push(payload.text),
  };
  const msg = {
    key: { remoteJid: sender, participant: sender, fromMe: false },
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
    process.env.MESH_AI_MANAGED_MODEL = 'test-model';
    process.env.MESH_AI_WEB_SEARCH_MODE = 'auto';
    delete process.env.MESH_AI_API_KEY;
    delete process.env.MESH_AI_TAVILY_API_KEY;
    meshAi.resetRuntimeState({ clearAutoReply: true });
    global.mode = 'public';
    global.owner = [ownerSender];

    const config = meshAi.getMeshAiConfig();
    assert.equal(config.provider, 'managed');
    assert.equal(config.assistantName, 'MESH AI');
    assert.equal(config.managed.model, 'test-model');
    assert.equal(config.managed.apiKey, '');

    const prompt = meshAi.buildSystemPrompt(config);
    assert(prompt.includes('MESH AI'));
    assert(prompt.includes('Do not claim to be BWM XMD'));
    assert(prompt.includes('public web references'));

    const help = await invokeAi(['help']);
    assert(help.includes('.chatbot on'));
    assert(help.includes('all DMs'));

    const missingConfig = await invokeAi(['Hello', 'MESH', 'AI']);
    assert(missingConfig.includes('not configured yet'));
    assert(!missingConfig.includes('MESH_AI_API_KEY='));

    const defaultState = await invokeChatbot(['status']);
    assert(defaultState.includes('Automatic direct-message replies: off'));
    assert.equal(meshAi.isChatbotAutoReplyEnabled(), false);

    const denied = await invokeChatbot(['on']);
    assert(denied.includes('Only the bot owner'));

    const routedStatus = await invokeDispatcher('.chatbot status');
    assert(routedStatus.includes('Automatic direct-message replies: off'));

    const routedEnable = await invokeDispatcher('.chatbot on', ownerSender);
    assert(routedEnable.includes('Global chatbot enabled'), routedEnable);
    assert.equal(meshAi.isChatbotAutoReplyEnabled(), true);

    const routedAlias = await invokeDispatcher('.mesh Tell me about MESH AI');
    assert(routedAlias.includes('not configured yet'));

    process.env.MESH_AI_API_KEY = 'test-key-only-for-local-eligibility-checks';
    assert.equal(meshAi.autoReplyEnabled({ text: 'Hello', chatId: directChat, isGroup: false, fromMe: false }), true);
    assert.equal(meshAi.autoReplyEnabled({ text: 'Hello', chatId: anotherDirectChat, isGroup: false, fromMe: false }), true);
    assert.equal(meshAi.autoReplyEnabled({ text: '.menu', chatId: directChat, isGroup: false, fromMe: false }), false);
    assert.equal(meshAi.autoReplyEnabled({ text: 'Hello', chatId: groupChat, isGroup: true, fromMe: false }), false);
    assert.equal(meshAi.autoReplyEnabled({ text: 'Hello', chatId: directChat, isGroup: false, fromMe: true }), false);

    assert.equal(meshAi.shouldSearchQuestion(meshAi.getMeshAiConfig(), 'What is the latest news today?'), false);
    process.env.MESH_AI_TAVILY_API_KEY = 'test-search-key-only-for-local-eligibility-checks';
    assert.equal(meshAi.shouldSearchQuestion(meshAi.getMeshAiConfig(), 'What is the latest news today?'), true);
    assert.equal(meshAi.shouldSearchQuestion(meshAi.getMeshAiConfig(), 'Explain JavaScript arrays'), false);

    const routedDisable = await invokeDispatcher('.chatbot off', ownerSender);
    assert(routedDisable.includes('Global chatbot disabled'));
    assert.equal(meshAi.isChatbotAutoReplyEnabled(), false);
    assert.equal(meshAi.autoReplyEnabled({ text: 'Hello', chatId: directChat, isGroup: false, fromMe: false }), false);

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

    console.log('PASS: MESH AI global owner controls, automatic DM replies, web-search safeguards, and provider settings are working.');
  } finally {
    meshAi.resetRuntimeState({ clearAutoReply: true });
    restoreEnvironment();
    global.mode = originalMode;
    global.owner = originalOwners;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
