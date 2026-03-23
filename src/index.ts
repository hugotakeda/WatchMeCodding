import express from 'express';
import http from 'http';
import cors from 'cors';
import WebSocket from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { v4 as uuidv4 } from 'uuid';
import * as roomManager from './roomManager';
import * as commitStore from './commitStore';
import * as discordRelay from './discordRelay';
import { ChangeEvent } from './types';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
app.use(cors());
app.use(express.json());

// ─── REST Routes ─────────────────────────────────────────────────────────────

// Create room
app.post('/api/rooms', (req, res) => {
  const { ownerName } = req.body;
  if (!ownerName) return res.status(400).json({ error: 'ownerName required' });
  const result = roomManager.createRoom(ownerName);
  res.json(result);
});

// Join room via invite token
app.post('/api/rooms/join', (req, res) => {
  const { inviteToken, userName } = req.body;
  if (!inviteToken || !userName)
    return res.status(400).json({ error: 'inviteToken and userName required' });
  const result = roomManager.joinRoom(inviteToken, userName);
  if (!result) return res.status(404).json({ error: 'Invalid invite token' });
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
  const body = req.body as ChangeEvent & { token?: string };
  const { roomId } = req.params;

  const member = roomManager.validateToken(roomId, body.token || '');
  if (!member) return res.status(401).json({ error: 'Invalid token' });

  const event: ChangeEvent & { roomId: string } = {
    ...(body as ChangeEvent),
    roomId,
    userName: member.name,
    timestamp: Date.now(),
  } as any;

  await commitStore.bufferChange(event as any);
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
  if (!member) return res.status(401).json({ error: 'Invalid token' });
  roomManager.updateMemberPresence(roomId, member.userId, currentFile, currentLine);
  res.json({ ok: true });
});

// Invite link redirect
app.get('/join/:inviteToken', (req, res) => {
  const room = roomManager.getRoomByInvite(req.params.inviteToken);
  if (!room) return res.status(404).send('Invalid or expired invite link');
  res.json({
    message: 'Valid invite link',
    inviteToken: req.params.inviteToken,
    memberCount: room.members.size,
  });
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ─── HTTP + WebSocket Server ──────────────────────────────────────────────────

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

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
      setupWSConnection(ws, request, { docName: roomId });
    });
  } else {
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
