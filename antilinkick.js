'use strict';

// Compatibility wrapper for the legacy `.antilinkick` spelling. The supported
// V2.4 anti-link policy lives in antilinkkick.js and includes per-group warning
// templates, persistent strikes, and group-admin safety checks.
const antiLinkKick = require('./antilinkkick');

async function run(context) {
  return antiLinkKick.configureAntilinkKick(context);
}

module.exports = {
  run,
  configureAntilinkKick: antiLinkKick.configureAntilinkKick,
  checkAntilinkKick: antiLinkKick.checkAntilinkKick,
  isAntilinkKickEnabled: antiLinkKick.isAntilinkKickEnabled,
};
