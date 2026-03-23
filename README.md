# Commit Watcher 🔗

> Real-time collaborative editing for VS Code — with live cursors, auto-commits, and Discord notifications.

---

## 🗂 Project Structure

```
Commit Watcher/
├── packages/
│   ├── extension/    ← VS Code Extension (TypeScript)
│   └── server/       ← Backend (Node.js + WebSockets)
└── README.md
```

---

## 🚀 Quick Start

### 1. Start the Backend Server

```bash
cd packages/server
npm install
cp .env.example .env
# Edit .env if needed (default port: 3001)
npm run dev
```

The server will start at **http://localhost:3001**.

### 2. Install the Extension

> **Option A — Development (recommended for first run)**

```bash
cd packages/extension
npm install
npm run compile
```

Then in VS Code:
- Press `F5` to open a new **Extension Development Host** window
- The Commit Watcher sidebar icon will appear in the Activity Bar

> **Option B — Package and install as .vsix**

```bash
cd packages/extension
npm install -g @vscode/vsce
vsce package
code --install-extension commit-watcher-1.0.0.vsix
```

---

## 🎯 Usage

### Creating a Group

1. Click the **Commit Watcher** icon in the Activity Bar (⌚)
2. Click **✨ Create Group** and enter your display name
3. The invite link is **automatically copied to clipboard**
4. Share the link with your teammates

### Joining a Group

1. Click **🔗 Join Group** in the sidebar
2. Paste the invite link
3. Enter your display name
4. You're in — edits will sync in real time!

### Real-time Collaboration

- All file edits are synced instantly via **Yjs CRDT** (conflict-free)
- Remote cursors appear as **colored inline labels** at collaborators' positions
- The **Members** tab shows who's online and which file they're editing
- The **History** tab shows a timeline of logical "commits"

---

## 🔔 Discord Notifications

1. Create a webhook in your Discord server:
   - Channel Settings → Integrations → Webhooks → New Webhook
   - Copy the webhook URL
2. In VS Code settings (`ctrl+,`), search for `commitWatcher.discordWebhook`
3. Paste the URL and set `commitWatcher.notificationLevel` to `saves` or `all`

Messages sent to Discord include:
- Author name
- Files changed
- Diff preview

---

## ⚙️ Extension Settings

| Setting | Default | Description |
|---|---|---|
| `commitWatcher.serverUrl` | `http://localhost:3001` | Backend server URL |
| `commitWatcher.displayName` | _(empty)_ | Your display name |
| `commitWatcher.discordWebhook` | _(empty)_ | Discord webhook URL |
| `commitWatcher.notificationLevel` | `saves` | `all` / `saves` / `off` |

---

## 🌐 Deploying the Server

### Railway (recommended)

1. Push `packages/server` to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from Repo
3. Set environment variable: `PUBLIC_URL=https://your-app.railway.app`
4. Set `PORT=3001` (or Railway auto-sets `$PORT`)

### Render

1. Create a new **Web Service** pointing to `packages/server`
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Set `PUBLIC_URL` to your Render URL

### VPS (Ubuntu/Debian example)

```bash
git clone <your-repo>
cd "Commit Watcher/packages/server"
npm install && npm run build
# Using PM2:
npm i -g pm2
pm2 start dist/index.js --name commit-watcher
pm2 startup && pm2 save
```

For HTTPS use **Nginx** as a reverse proxy with Certbot for SSL.

---

## 🔒 Security Notes

- Invite links use UUID tokens — long and unguessable
- Token validation on every REST call and WebSocket upgrade
- HTTPS/WSS recommended in production (configure via reverse proxy)
- Room members are identified by UUID, not by username alone

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                  VS Code Extension                   │
│                                                      │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │GroupManager│  │SyncProvider  │  │PresenceManager│ │
│  │(REST API) │  │(Yjs + WS)    │  │(Awareness)   │  │
│  └───────────┘  └──────────────┘  └──────────────┘  │
│  ┌───────────┐  ┌──────────────┐                     │
│  │CommitTrack│  │Sidebar WebUI │                     │
│  │(debounce) │  │(HTML/CSS/JS) │                     │
│  └───────────┘  └──────────────┘                     │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP REST + WSS
┌─────────────────────▼───────────────────────────────┐
│                  Node.js Server                      │
│                                                      │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │RoomManager│  │CommitStore   │  │DiscordRelay  │  │
│  │(sessions) │  │(JSON + debou)│  │(webhook POST)│  │
│  └───────────┘  └──────────────┘  └──────────────┘  │
│         y-websocket (Yjs CRDT per room)              │
└──────────────────────────────────────────────────────┘
```

---

## 📦 Tech Stack

| Component | Technology |
|---|---|
| Real-time sync | **Yjs** (CRDT) + `y-websocket` |
| Backend | Express.js + `ws` |
| Extension | VS Code API (TypeScript) |
| Presence | Yjs Awareness Protocol |
| Notifications | Discord Webhooks |
| Commit storage | JSON files per room |

---

## 🔮 Future Enhancements

- [ ] Git integration (map logical commits to real Git commits)
- [ ] In-sidebar text chat between members
- [ ] Terminal sharing (via `vscode.window.createTerminal`)
- [ ] Invite link expiration
- [ ] Persistent storage (PostgreSQL / Redis)
- [ ] Read-only mode per member
