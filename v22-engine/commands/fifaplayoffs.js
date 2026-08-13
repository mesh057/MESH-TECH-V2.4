'use strict';

const { createScoreboardCommand } = require('../utils/footballData');

module.exports = createScoreboardCommand({
  name: 'fifaplayoffs',
  description: 'Shows current FIFA World Cup playoff and knockout fixtures.',
  league: 'fifa.world',
  label: 'FIFA World Cup fixtures',
  loadingText: '🏆 Fetching FIFA playoff fixtures...',
});
