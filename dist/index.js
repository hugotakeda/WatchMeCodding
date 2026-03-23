"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const ws_1 = __importDefault(require("ws"));
const utils_1 = require("y-websocket/bin/utils");
const roomManager = __importStar(require("./roomManager"));
const commitStore = __importStar(require("./commitStore"));
const discordRelay = __importStar(require("./discordRelay"));
const PORT = parseInt(process.env.PORT || '3001', 10);
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ─── REST Routes ─────────────────────────────────────────────────────────────
// Create room
app.post('/api/rooms', (req, res) => {
    const { ownerName } = req.body;
    if (!ownerName)
        return res.status(400).json({ error: 'ownerName required' });
    const result = roomManager.createRoom(ownerName);
    res.json(result);
});
// Join room via invite token
app.post('/api/rooms/join', (req, res) => {
    const { inviteToken, userName } = req.body;
    if (!inviteToken || !userName)
        return res.status(400).json({ error: 'inviteToken and userName required' });
    const result = roomManager.joinRoom(inviteToken, userName);
    if (!result)
        return res.status(404).json({ error: 'Invalid invite token' });
    res.json(result);
});
// Get room members
app.get('/api/rooms/:roomId/members', (req, res) => {
    const members = roomManager.getMembers(req.params.roomId);
    res.json(members.map((m) => ({ ...m, token: undefined })));
});
// Get commits
app.get('/api/rooms/:roomId/commits', async (req, res) => {
    const commits = await commitStore.getCommits(req.params.roomId);
    res.json(commits);
});
// Ingest a change event from extension
app.post('/api/rooms/:roomId/changes', async (req, res) => {
    const body = req.body;
    const { roomId } = req.params;
    const member = roomManager.validateToken(roomId, body.token || '');
    if (!member)
        return res.status(401).json({ error: 'Invalid token' });
    const event = {
        ...body,
        roomId,
        userName: member.name,
        timestamp: Date.now(),
    };
    await commitStore.bufferChange(event);
    res.json({ ok: true });
});
// Configure Discord webhook for a room
app.post('/api/rooms/:roomId/discord', (req, res) => {
    const { token, webhookUrl, level } = req.body;
    const { roomId } = req.params;
    if (!roomManager.validateToken(roomId, token))
        return res.status(401).json({ error: 'Invalid token' });
    discordRelay.setDiscordConfig(roomId, {
        webhookUrl,
        level: level || 'saves',
    });
    res.json({ ok: true });
});
// Update member presence (file/line)
app.post('/api/rooms/:roomId/presence', (req, res) => {
    const { token, currentFile, currentLine } = req.body;
    const { roomId } = req.params;
    const member = roomManager.validateToken(roomId, token);
    if (!member)
        return res.status(401).json({ error: 'Invalid token' });
    roomManager.updateMemberPresence(roomId, member.userId, currentFile, currentLine);
    res.json({ ok: true });
});
// Invite link redirect
app.get('/join/:inviteToken', (req, res) => {
    const room = roomManager.getRoomByInvite(req.params.inviteToken);
    if (!room)
        return res.status(404).send('Invalid or expired invite link');
    res.json({
        message: 'Valid invite link',
        inviteToken: req.params.inviteToken,
        memberCount: room.members.size,
    });
});
// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
// ─── HTTP + WebSocket Server ──────────────────────────────────────────────────
const server = http_1.default.createServer(app);
const wss = new ws_1.default.Server({ noServer: true });
// y-websocket protocol: ws://<host>/yjs/<roomId>?token=<userToken>
server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://localhost`);
    const pathname = url.pathname;
    if (pathname.startsWith('/yjs/')) {
        const roomId = pathname.replace('/yjs/', '');
        const token = url.searchParams.get('token') || '';
        const member = roomManager.validateToken(roomId, token);
        if (!member) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
            // y-websocket expects the room name to be the doc name
            (0, utils_1.setupWSConnection)(ws, request, { docName: roomId });
        });
    }
    else {
        socket.destroy();
    }
});
// ─── Commit → Discord relay ───────────────────────────────────────────────────
commitStore.onCommit((commit) => {
    discordRelay.sendCommitNotification(commit).catch(console.error);
});
// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`✅ Commit Watcher server running on port ${PORT}`);
    console.log(`   REST  → http://localhost:${PORT}/api`);
    console.log(`   WS    → ws://localhost:${PORT}/yjs/<roomId>?token=<token>`);
});
