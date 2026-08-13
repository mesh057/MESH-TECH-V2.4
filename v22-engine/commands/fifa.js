'use strict';

const { createStandingsCommand } = require('../utils/footballData');

module.exports = createStandingsCommand({
  name: 'fifa',
  description: 'Shows current FIFA World Cup standings and groups.',
  league: 'fifa.world',
  label: 'FIFA World Cup',
  loadingText: '🏆 Fetching FIFA standings...',
});
