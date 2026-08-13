'use strict';

const { createStandingsCommand } = require('../utils/footballData');

module.exports = createStandingsCommand({
  name: 'euro',
  description: 'Shows current Euro Championship standings.',
  league: 'uefa.euro',
  label: 'Euro Championship',
  loadingText: '🏆 Fetching Euro standings...',
});
