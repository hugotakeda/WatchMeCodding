import { v4 as uuidv4 } from 'uuid';
import { Room, Member, UserInfo } from './types';

const rooms = new Map<string, Room>();
const inviteIndex = new Map<string, string>(); // inviteToken → roomId

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9',
];
let colorIdx = 0;

function nextColor(): string {
  return COLORS[colorIdx++ % COLORS.length];
}

export function createRoom(ownerName: string): {
  roomId: string;
  inviteToken: string;
  inviteLink: string;
  ownerToken: string;
  ownerUserId: string;
} {
  const roomId = uuidv4();
  const inviteToken = uuidv4().replace(/-/g, '');
  const ownerToken = uuidv4();
  const ownerUserId = uuidv4();

  const owner: Member = {
    userId: ownerUserId,
    name: ownerName,
    color: nextColor(),
    token: ownerToken,
    joinedAt: Date.now(),
  };

  const room: Room = {
    roomId,
    ownerToken,
    inviteToken,
    members: new Map([[ownerUserId, owner]]),
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  inviteIndex.set(inviteToken, roomId);

  const serverUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
  const inviteLink = `${serverUrl}/join/${inviteToken}`;

  return { roomId, inviteToken, inviteLink, ownerToken, ownerUserId };
}

export function joinRoom(
  inviteToken: string,
  userName: string,
): { roomId: string; userToken: string; userId: string; user: Member } | null {
  const roomId = inviteIndex.get(inviteToken);
  if (!roomId) return null;

  const room = rooms.get(roomId);
  if (!room) return null;

  const userToken = uuidv4();
  const userId = uuidv4();

  const member: Member = {
    userId,
    name: userName,
    color: nextColor(),
    token: userToken,
    joinedAt: Date.now(),
  };

  room.members.set(userId, member);
  return { roomId, userToken, userId, user: member };
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getRoomByInvite(inviteToken: string): Room | undefined {
  const roomId = inviteIndex.get(inviteToken);
  if (!roomId) return undefined;
  return rooms.get(roomId);
}

export function removeMember(roomId: string, userId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.members.delete(userId);
    if (room.members.size === 0) {
      rooms.delete(roomId);
    }
  }
}

export function updateMemberPresence(
  roomId: string,
  userId: string,
  currentFile?: string,
  currentLine?: number,
): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const member = room.members.get(userId);
  if (!member) return;
  if (currentFile !== undefined) member.currentFile = currentFile;
  if (currentLine !== undefined) member.currentLine = currentLine;
}

export function getMembers(roomId: string): Member[] {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.members.values());
}

export function validateToken(roomId: string, token: string): Member | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  for (const member of room.members.values()) {
    if (member.token === token) return member;
  }
  return null;
}

export function isOwner(roomId: string, token: string): boolean {
  const room = rooms.get(roomId);
  return room?.ownerToken === token;
}
