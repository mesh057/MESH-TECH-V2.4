'use strict';

const { createStandingsCommand } = require('../utils/footballData');

module.exports = createStandingsCommand({
  name: 'epl',
  description: 'Shows the current English Premier League standings.',
  league: 'eng.1',
  label: 'English Premier League',
  loadingText: '🏆 Fetching Premier League standings...',
});
