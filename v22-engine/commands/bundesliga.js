'use strict';

const { createStandingsCommand } = require('../utils/footballData');

module.exports = createStandingsCommand({
  name: 'bundesliga',
  description: 'Shows the current Bundesliga standings.',
  league: 'ger.1',
  label: 'German Bundesliga',
  loadingText: '🇩🇪 Fetching Bundesliga standings...',
});
