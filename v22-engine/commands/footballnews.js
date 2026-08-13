'use strict';

const axios = require('axios');

const NEWS_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news';

module.exports = {
  name: 'news',
  description: 'Get the latest football news.',
  category: 'SPORTS',
  async execute(sock, msg) {
    const chatId = msg.key.remoteJid;
    const loading = await sock.sendMessage(chatId, { text: '📰 Fetching latest football news...' }, { quoted: msg });
    try {
      const { data } = await axios.get(NEWS_URL, {
        timeout: 15_000,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      const articles = Array.isArray(data?.articles) ? data.articles.slice(0, 8) : [];
      if (!articles.length) throw new Error('No football news is available.');

      const text = [
        '📰 *LATEST FOOTBALL NEWS*',
        '',
        ...articles.map((article, index) => {
          const date = article.published ? `📅 ${new Date(article.published).toLocaleDateString('en-GB')}` : '';
          const source = article.source ? `📰 ${article.source}` : '';
          const link = article.links?.web?.href || article.links?.api?.news?.href || '';
          return [`*${index + 1}. ${article.headline || 'Football update'}*`, date, source, link ? `🔗 ${link}` : '']
            .filter(Boolean)
            .join('\n');
        }),
      ].join('\n\n');

      await sock.sendMessage(chatId, { text: text.slice(0, 60_000), edit: loading.key });
    } catch (error) {
      console.error('[football-news] failed:', error.message);
      await sock.sendMessage(chatId, {
        text: '⚠️ Football news is temporarily unavailable. Please try again shortly.',
        edit: loading.key,
      });
    }
  },
};
