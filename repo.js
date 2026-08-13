'use strict';

const REPOSITORY_URL = 'https://github.com/mesh057/MESH-TECH-V2.4';

async function repoCommand({ reply }) {
  return reply(
`╭━━━〔 *MESH-TECH V2.4* 〕━━━╮
┃ 📦 Repository
┃ ${REPOSITORY_URL}
┃ ⚙️ Multi-user WhatsApp bot
┃ 🛡️ Restored V2.4 command suite
╰━━━━━━━━━━━━━━━━━━━━━━╯`
  );
}

module.exports = repoCommand;
module.exports.REPOSITORY_URL = REPOSITORY_URL;
