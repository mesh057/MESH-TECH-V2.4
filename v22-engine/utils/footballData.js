'use strict';

const axios = require('axios');

const ESPN_SITE_BASE = 'https://site.api.espn.com/apis';
const REQUEST_TIMEOUT_MS = 15_000;

function stat(entry, name, fallback = '—') {
  const value = (entry.stats || []).find((item) => item.name === name);
  if (!value) return fallback;
  return value.displayValue ?? value.value ?? fallback;
}

function formatStandingLine(entry) {
  const rank = String(stat(entry, 'rank', '—')).padEnd(3);
  const team = String(entry.team?.shortDisplayName || entry.team?.displayName || 'Unknown')
    .replace(/\s+(?:FC|AFC)$/i, '')
    .slice(0, 18)
    .padEnd(18);
  const played = String(stat(entry, 'gamesPlayed', '—')).padEnd(3);
  const goalDifference = String(stat(entry, 'pointDifferential', '—'));
  const gd = (goalDifference !== '—' && !/^[+-]/.test(goalDifference) && goalDifference !== '0'
    ? `+${goalDifference}`
    : goalDifference).padEnd(4);
  const points = String(stat(entry, 'points', '—')).padStart(3);
  return `${rank}${team}${played}${gd}${points}`;
}

function formatStandings(payload, fallbackLabel) {
  const groups = (payload.children || [])
    .map((child) => ({ name: child.name, entries: child.standings?.entries || [] }))
    .filter((group) => group.entries.length);
  if (!groups.length) throw new Error('No current standings are available.');

  const title = String(payload.name || fallbackLabel);
  const sections = groups.map((group) => {
    const heading = groups.length > 1 ? `\n*${group.name}*\n` : '';
    const rows = group.entries.map(formatStandingLine).join('\n');
    return `${heading}\`\`\`\nPos Team               GP GD Pts\n───────────────────────────────\n${rows}\n\`\`\``;
  });

  return `🏆 *${title}*\n${sections.join('\n')}`.slice(0, 64_000);
}

function formatScoreboard(payload, fallbackLabel) {
  const events = Array.isArray(payload.events) ? payload.events : [];
  if (!events.length) throw new Error('No current playoff fixtures or results are available.');

  const rows = events.slice(0, 12).map((event) => {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];
    const home = competitors.find((item) => item.homeAway === 'home');
    const away = competitors.find((item) => item.homeAway === 'away');
    const homeName = home?.team?.shortDisplayName || home?.team?.displayName || 'TBD';
    const awayName = away?.team?.shortDisplayName || away?.team?.displayName || 'TBD';
    const score = `${home?.score ?? '—'} - ${away?.score ?? '—'}`;
    const state = event.status?.type?.shortDetail || event.date || '';
    return `• ${homeName} ${score} ${awayName}${state ? `\n  ${state}` : ''}`;
  });

  return `🏆 *${fallbackLabel}*\n\n${rows.join('\n\n')}`;
}

async function fetchJson(url) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    validateStatus: (status) => status >= 200 && status < 300,
  });
  return response.data;
}

function createStandingsCommand({ name, description, league, label, loadingText }) {
  return {
    name,
    description,
    category: 'SPORTS',
    async execute(sock, msg) {
      const jid = msg.key.remoteJid;
      const loading = await sock.sendMessage(jid, { text: loadingText }, { quoted: msg });
      try {
        const payload = await fetchJson(`${ESPN_SITE_BASE}/v2/sports/soccer/${league}/standings`);
        await sock.sendMessage(jid, { text: formatStandings(payload, label), edit: loading.key });
      } catch (error) {
        await sock.sendMessage(jid, {
          text: `⚠️ ${label} standings are temporarily unavailable. Please try again shortly.`,
          edit: loading.key,
        });
        console.error(`[football] ${name} failed:`, error.message);
      }
    },
  };
}

function createScoreboardCommand({ name, description, league, label, loadingText }) {
  return {
    name,
    description,
    category: 'SPORTS',
    async execute(sock, msg) {
      const jid = msg.key.remoteJid;
      const loading = await sock.sendMessage(jid, { text: loadingText }, { quoted: msg });
      try {
        const payload = await fetchJson(`${ESPN_SITE_BASE}/site/v2/sports/soccer/${league}/scoreboard`);
        await sock.sendMessage(jid, { text: formatScoreboard(payload, label), edit: loading.key });
      } catch (error) {
        await sock.sendMessage(jid, {
          text: `⚠️ ${label} fixtures are temporarily unavailable. Please try again shortly.`,
          edit: loading.key,
        });
        console.error(`[football] ${name} failed:`, error.message);
      }
    },
  };
}

module.exports = {
  createScoreboardCommand,
  createStandingsCommand,
  formatScoreboard,
  formatStandings,
};
