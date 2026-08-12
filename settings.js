const ownerNumber = require('./Owner/owner');

const config = {
  botName: 'MESH TECH MD',
  ownerNumber,
  ownerName: 'MESH TECH',
  signature: '> MESH TECH MD ✓',
  logo: 'https://i.postimg.cc/vHZz7VWG/bot-logo.png',
  groupLink: 'https://chat.whatsapp.com/DM1JxxnOJFp0vsTHpej89M?s=cl&p=a&ilr=4',
  channelLink: 'https://whatsapp.com/channel/0029VbDeTrNEKyZ9GlUude2R',
  github: 'https://github.com/mesh057/MESH-TECH-V2.4',
  youtube: '',
  autoTyping: false,
  autoReact: false,
  autoStatusView: false,
  public: true,
  antiLink: false,
  antiBug: false,
  greetings: true,
  readmore: false,
  ANTIDELETE: true
};

global.owner = (Array.isArray(ownerNumber) ? ownerNumber : [ownerNumber])
  .map(num => num.replace(/\D/g, '') + '@s.whatsapp.net');

function loadSettings() {
  return config;
}
module.exports = { loadSettings };
