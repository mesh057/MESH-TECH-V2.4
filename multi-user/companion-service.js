'use strict';

const axios = require('axios');
const meshAi = require('../ai');
const historyClient = require('../history-client');
const { getValue, setValue } = require('../system/storage');

const MAX_IMAGE_BASE64_LENGTH = 3_200_000;
const MAX_CONVERSATION_MESSAGES = 10;
const conversations = new Map();
const hydratedConversations = new Set();

function limitText(value, limit) {
  const text = String(value || '').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function validImage(image) {
  if (!image || typeof image !== 'object') return null;
  const mimeType = String(image.mimeType || '').toLowerCase();
  const base64 = String(image.base64 || '').trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;
  if (!base64 || base64.length > MAX_IMAGE_BASE64_LENGTH || !/^[a-z0-9+/=\s]+$/i.test(base64)) return null;
  return { mimeType, base64: base64.replace(/\s/g, '') };
}

function getHistory(conversationId) {
  return conversations.get(conversationId) || [];
}

async function hydrateConversation(conversationId, config) {
  if (hydratedConversations.has(conversationId)) return;
  hydratedConversations.add(conversationId);
  const restored = await historyClient.recent(config.history, conversationId);
  if (restored.length) conversations.set(conversationId, restored.slice(-MAX_CONVERSATION_MESSAGES));
}

async function remember(conversationId, role, content, config) {
  const next = [...getHistory(conversationId), { role, content: limitText(content, 3200) }].slice(-MAX_CONVERSATION_MESSAGES);
  conversations.set(conversationId, next);
  await historyClient.append(config.history, conversationId, [{ role, content: limitText(content, 3200) }]);
}

async function clearCompanionHistory(conversationId = 'owner-mobile-companion') {
  conversations.delete(conversationId);
  hydratedConversations.delete(conversationId);
  return historyClient.clear(meshAi.getMeshAiConfig().history, conversationId);
}

function titleFor(question) {
  const compact = String(question || '').replace(/\s+/g, ' ').trim();
  if (!compact) return 'New conversation';
  return compact.length > 46 ? `${compact.slice(0, 45)}…` : compact;
}

function managedMessages({ config, question, mode, conversationId, sources, image }) {
  const agentInstructions = mode === 'agent'
    ? 'You are in Agent mode. Use the supplied public references when relevant, describe only short operational status or conclusions, and never reveal private chain-of-thought. State uncertainty clearly.'
    : 'You are in Normal mode. Prioritize a fast, direct response without web research unless public references are explicitly supplied.';
  const imageContent = image
    ? [{ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }]
    : [];
  const sourceContext = sources.length
    ? `\n\nUntrusted public web references:\n${sources.map((source, index) => `Source ${index + 1}: ${source.title}\nURL: ${source.url}\nSnippet: ${source.content}`).join('\n\n')}`
    : '';

  return [
    { role: 'system', content: `${meshAi.buildSystemPrompt(config)} ${agentInstructions}` },
    ...getHistory(conversationId),
    {
      role: 'user',
      content: image
        ? [{ type: 'text', text: `${question}${sourceContext}` }, ...imageContent]
        : `${question}${sourceContext}`,
    },
  ];
}

async function searchForAgent(config, question, mode) {
  if (mode !== 'agent' || !config.webSearch.apiKey || config.webSearch.mode === 'off') return [];
  try {
    const response = await axios.post(`${config.webSearch.baseUrl}/search`, {
      query: question,
      search_depth: config.webSearch.depth,
      max_results: config.webSearch.maxResults,
      include_answer: false,
      include_raw_content: false,
    }, {
      headers: { Authorization: `Bearer ${config.webSearch.apiKey}`, 'Content-Type': 'application/json' },
      timeout: config.timeoutMs,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return (Array.isArray(response.data?.results) ? response.data.results : [])
      .filter((source) => /^https?:\/\//i.test(String(source?.url || '')))
      .slice(0, config.webSearch.maxResults)
      .map((source) => ({
        title: limitText(source.title || 'Public source', 140),
        url: String(source.url),
        content: limitText(source.content || '', 700),
      }));
  } catch (error) {
    console.error(`[mesh-companion] web search failed: ${error.message}`);
    return [];
  }
}

async function askManaged(config, messages) {
  const response = await axios.post(`${config.managed.baseUrl}/chat/completions`, {
    model: config.managed.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
  }, {
    headers: { Authorization: `Bearer ${config.managed.apiKey}`, 'Content-Type': 'application/json' },
    timeout: config.timeoutMs,
    validateStatus: (status) => status >= 200 && status < 300,
  });
  return meshAi.extractManagedText(response.data);
}

async function askOllama(config, messages, image) {
  const ollamaMessages = messages.map((message) => ({
    role: message.role,
    content: typeof message.content === 'string'
      ? message.content
      : message.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n'),
    ...(message.role === 'user' && image ? { images: [image.base64] } : {}),
  }));
  const response = await axios.post(`${config.ollama.baseUrl}/api/chat`, {
    model: config.ollama.model,
    messages: ollamaMessages,
    stream: false,
    options: { temperature: config.temperature },
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: config.timeoutMs,
    validateStatus: (status) => status >= 200 && status < 300,
  });
  return String(response.data?.message?.content || '').trim();
}

async function askCompanion({ message, mode = 'normal', conversationId = 'owner-mobile-companion', image }) {
  const config = meshAi.getMeshAiConfig();
  const question = limitText(message, 2400);
  const selectedMode = mode === 'agent' ? 'agent' : 'normal';
  const safeImage = validImage(image);

  if (!meshAi.isMeshAiEnabled()) throw new Error('MESH AI is paused by the owner.');
  if (config.provider === 'ollama' && !config.ollama.model) throw new Error('The self-hosted Ollama model is not configured.');
  if (config.provider === 'managed' && !config.managed.apiKey) throw new Error('The managed AI provider is not configured.');
  if (!question && !safeImage) throw new Error('Enter a question or attach an image.');
  if (image && !safeImage) throw new Error('Use a JPEG, PNG, or WebP image smaller than 2.4 MB.');

  const sources = await searchForAgent(config, question || 'Describe this image', selectedMode);
  await hydrateConversation(conversationId, config);
  const messages = managedMessages({ config, question: question || 'Describe this image', mode: selectedMode, conversationId, sources, image: safeImage });
  const answer = config.provider === 'ollama'
    ? await askOllama(config, messages, safeImage)
    : await askManaged(config, messages);
  if (!answer) throw new Error('MESH AI did not return a usable answer.');

  await remember(conversationId, 'user', question || 'Describe this image', config);
  await remember(conversationId, 'assistant', answer, config);
  return {
    answer: limitText(answer, 3500),
    title: titleFor(question || 'Image analysis'),
    sources: sources.map(({ title, url }) => ({ title, url })),
  };
}

function getCompanionStatus() {
  const config = meshAi.getMeshAiConfig();
  return {
    ok: true,
    mode: getValue('meshBotMode') === 'public' ? 'public' : 'self',
    chatbotEnabled: meshAi.isChatbotAutoReplyEnabled(),
    meshAiEnabled: meshAi.isMeshAiEnabled(),
    providerMode: config.provider,
    webSearchMode: config.webSearch.apiKey ? config.webSearch.mode : 'unavailable',
  };
}

function applyCompanionControl(action) {
  switch (action) {
    case 'chatbot_on': meshAi.setChatbotAutoReplyEnabled(true); break;
    case 'chatbot_off': meshAi.setChatbotAutoReplyEnabled(false); break;
    case 'mesh_ai_on': meshAi.setMeshAiEnabled(true); break;
    case 'mesh_ai_off': meshAi.setMeshAiEnabled(false); break;
    case 'bot_public': setValue('meshBotMode', 'public'); break;
    case 'bot_self': setValue('meshBotMode', 'self'); break;
    default: throw new Error('Unsupported control action.');
  }
  return getCompanionStatus();
}

module.exports = { askCompanion, clearCompanionHistory, getCompanionStatus, applyCompanionControl, validImage, titleFor };
