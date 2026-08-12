<h1 align="center">𝐌𝐄𝐒𝐇 𝐓𝐄𝐂𝐇 𝐌𝐃</h1>

<p align="center">
  <img
    src="https://i.postimg.cc/vHZz7VWG/bot-logo.png"
    alt="MESH TECH MD Banner"
    width="100%"
  />
</p>

<div align="center">
  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Black+Ops+One&size=50&pause=1000&color=1BAFBAFF&center=true&width=910&height=100&lines=HELLO+THIS+IS+MESH+TECH+MD;MULTI+DEVICE+WHATSAPP+BOT;SCRIPTED+BY+MESH+TECH;FORK+AND+STAR+THE+REPO" alt="Typing SVG" />
  </a>
</div>

<h1 align="center">𝐒𝐄𝐓 𝐔𝐏</h1>

## ` Fork this repo`

<p align="center">
  <a href="https://github.com/mesh057/MESH-TECH-V2.4/fork">
    <img src="https://img.shields.io/badge/Fork%20Create-purple?style=for-the-badge&logo=github" alt="Fork MESH TECH MD V2.4" width="160" />
  </a>
</p>

## ` Multi-user pairing`

MESH TECH MD V2.4 includes a separate multi-user pairing service. Start the pairing portal on a machine or hosting platform that exposes a public HTTP address, then open that address in a browser to create an isolated session for each WhatsApp number.

<p align="center">
  <a href="https://github.com/mesh057/MESH-TECH-V2.4/tree/main/multi-user">
    <img height="37" title="Open multi-user pairing source" src="https://img.shields.io/badge/Session%201-green?style=for-the-badge&logo=whatsapp" alt="Session 1" />
  </a>
  <a href="https://github.com/mesh057/MESH-TECH-V2.4/tree/main/multi-user">
    <img height="37" title="Open multi-user pairing source" src="https://img.shields.io/badge/Session%202-green?style=for-the-badge&logo=whatsapp" alt="Session 2" />
  </a>
</p>

## ` Deploy the multi-user portal `

Install dependencies and run the dedicated pairing server. The server uses port `3000` by default, or the value supplied through `MULTI_USER_PORT` or `PORT`.

```bash
git clone https://github.com/mesh057/MESH-TECH-V2.4.git
cd MESH-TECH-V2.4
npm install
node multi-user/server.js
```

After deployment, visit `https://your-domain.example/` to open the pairing page. The health endpoint is available at `/health`, and the live session status endpoint is available at `/api/status`.

## ` Run a single bot locally `

For a standard local WhatsApp connection, install the dependencies and start the bot. On its first run, enter the number with its country code when prompted, then link the code through **WhatsApp → Linked devices → Link with phone number**.

```bash
npm install
npm start
```

## PANEL DEPLOYMENT

<p align="center">
  <b>Click below to download the latest MESH TECH MD V2.4 ZIP archive.</b>
  <br /><br />
  <a href="https://github.com/mesh057/MESH-TECH-V2.4/archive/refs/heads/main.zip">
    <img src="https://img.shields.io/badge/download-zip-blue" alt="Download MESH TECH MD V2.4 ZIP" width="200" />
  </a>
</p>

<p align="center">
  <a href="https://wa.me/254746844168?text=Hello%20Mesh%20Tech%2C%20I%20need%20help%20with%20MESH%20TECH%20MD.">
    <img src="https://img.shields.io/badge/Contact_Developer-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Contact developer" />
  </a>
</p>

<p align="center">
  <a href="https://chat.whatsapp.com/DM1JxxnOJFp0vsTHpej89M?s=cl&p=a&ilr=4">
    <img src="https://img.shields.io/badge/WhatsApp_Group-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp group" />
  </a>
  <a href="https://whatsapp.com/channel/0029VbDeTrNEKyZ9GlUude2R">
    <img src="https://img.shields.io/badge/WhatsApp_Channel-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp channel" />
  </a>
</p>

> Modify the project structure at your own risk. Keep your authentication folders private and never upload linked-device credentials to GitHub or share them with anyone.

## Command system

MESH TECH MD V2.4 processes commands through `menu/case.js`. It also includes configurable moderation and automation functions such as anti-link handling, anti-link removal, anti-delete, auto-typing, auto-react, auto-status viewing, and group greetings.

The current configuration is loaded from `settings.js`. Update the owner number, bot name, branding links, and default feature flags there before deploying the bot. The default owner value is stored in `Owner/owner.js`.

| Area | Main file | Purpose |
| --- | --- | --- |
| Bot startup and WhatsApp connection | `index.js` | Starts the WhatsApp client and receives messages. |
| Commands | `menu/case.js` | Handles bot commands and responses. |
| Bot settings | `settings.js` | Defines owner information, branding, and default feature settings. |
| Multi-user pairing service | `multi-user/server.js` | Serves the pairing page and controls isolated bot sessions. |
| Session isolation | `multi-user/session-manager.js` | Stores each user session in a separate authentication directory. |

## MESH AI

MESH AI is the original smart assistant for MESH TECH MD. Its identity, reply style, and owner instructions are defined by this project, while its model connection is supplied by an AI account or self-hosted service that you control. It uses original MESH TECH branding and does not imitate another bot’s identity or replies.

| Command | What it does |
| --- | --- |
| `.ai <question>` | Sends a question to MESH AI. |
| `.mesh <question>` | Alias for `.ai`. |
| `.ask <question>` | Alias for `.ai`. |
| `.ai help` | Shows MESH AI usage and privacy controls. |
| `.ai status` | Shows the active provider mode and readiness state without revealing credentials. |
| `.chatbot on` | Owner-only command that enables automatic MESH AI replies for every direct message. |
| `.chatbot off` | Owner-only command that stops automatic replies for every direct message. |
| `.chatbot status` | Shows the global chatbot state, provider readiness, and web-search state without exposing secrets. |
| `.ai reset` | Clears the stored short conversation context for the current chat. |
| `.ai on` / `.ai off` | Owner-only controls that enable or disable MESH AI until the bot restarts. |

Automatic direct-message replies are **off by default**. After configuring the provider and putting the bot in public mode with `.public`, the owner can send `.chatbot on` to let MESH AI answer ordinary messages from all direct-message users. Send `.chatbot off` at any time to stop the automatic replies globally. Automatic replies never run in groups, status broadcasts, or when the bot is in self mode.

Copy the relevant settings from `.env.ai.example` into your hosting provider’s private environment-variable panel. Keep `MESH_AI_API_KEY`, `MESH_AI_TAVILY_API_KEY`, and all other credentials private; never commit a real `.env` file, authentication folder, or session credential.

| Provider mode | Use when | Required settings |
| --- | --- | --- |
| `managed` | You want the bot to call an AI account that you own with usage-based billing. | `MESH_AI_API_KEY`, `MESH_AI_MANAGED_BASE_URL`, and `MESH_AI_MANAGED_MODEL` |
| `ollama` | You run a model yourself on a reachable server. | `MESH_AI_OLLAMA_BASE_URL` and `MESH_AI_OLLAMA_MODEL` |

Optional live web grounding uses `MESH_AI_WEB_SEARCH_MODE=auto` and a private `MESH_AI_TAVILY_API_KEY`. In `auto` mode, MESH AI searches current public sources for time-sensitive questions, such as news, weather, prices, results, or explicit requests for sources; it attaches the source links to the answer. Use `always` to search every question or `off` to disable web search.

For self-hosted mode, `http://127.0.0.1:11434` works only when Ollama and the bot run on the same machine. Use a private network address or protected HTTPS endpoint when the model is on another host.

## Multi-user API overview

The pairing page uses the following endpoints. Do not expose session access tokens publicly; they allow the holder to retrieve a pairing code or stop the associated session.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/health` | `GET` | Confirms that the pairing service is running. |
| `/api/status` | `GET` | Returns the current active-session summary. |
| `/api/request-pairing` | `POST` | Starts a user session for a valid country-code phone number. |
| `/api/pairing-code` | `GET` | Retrieves the pairing code when given the matching access token. |
| `/api/stop` | `POST` | Stops a session when given the matching access token. |

## Verify the multi-user setup

The repository includes a lightweight test that confirms that two phone numbers resolve to separate authentication directories. It does not connect to WhatsApp or create a real session.

```bash
node multi-user/test-isolation.js
```

## Media and customization

Project images and stickers are stored in `media/` and `assets/`. Edit the following files to customize your copy:

| Item | Location |
| --- | --- |
| Bot logo | `media/bot-logo.png` and `assets/mesh-tech-logo.png` |
| Menu display | `media/menu.js` |
| Owner number | `Owner/owner.js` |
| Branding and defaults | `settings.js` |

## Supported environments

MESH TECH MD V2.4 runs on Node.js-based environments, including Termux, Linux systems, hosting panels, and a suitable Node.js cloud host. Some media features may additionally need FFmpeg, ImageMagick, `libwebp`, or other system packages supplied by the platform.

## Responsible use

Use the bot only with accounts, groups, and participants for which you have permission. Do not use it to send unsolicited messages, evade platform protections, or disrupt other users.

## License

This project is licensed under the [MIT License](LICENSE).

<p align="center">
  <a href="https://github.com/mesh057/MESH-TECH-V2.4/stargazers">
    <img src="https://img.shields.io/github/stars/mesh057/MESH-TECH-V2.4?style=for-the-badge" alt="GitHub stars" />
  </a>
  <a href="https://github.com/mesh057/MESH-TECH-V2.4/network/members">
    <img src="https://img.shields.io/github/forks/mesh057/MESH-TECH-V2.4?style=for-the-badge" alt="GitHub forks" />
  </a>
</p>

<p align="center"><strong>MESH TECH MD V2.4 — multi-device WhatsApp bot.</strong></p>
