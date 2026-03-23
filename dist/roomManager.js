"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoom = createRoom;
exports.joinRoom = joinRoom;
exports.getRoom = getRoom;
exports.getRoomByInvite = getRoomByInvite;
exports.removeMember = removeMember;
exports.updateMemberPresence = updateMemberPresence;
exports.getMembers = getMembers;
exports.validateToken = validateToken;
exports.isOwner = isOwner;
const uuid_1 = require("uuid");
const rooms = new Map();
const inviteIndex = new Map(); // inviteToken → roomId
const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9',
];
let colorIdx = 0;
function nextColor() {
    return COLORS[colorIdx++ % COLORS.length];
}
function createRoom(ownerName) {
    const roomId = (0, uuid_1.v4)();
    const inviteToken = (0, uuid_1.v4)().replace(/-/g, '');
    const ownerToken = (0, uuid_1.v4)();
    const ownerUserId = (0, uuid_1.v4)();
    const owner = {
        userId: ownerUserId,
        name: ownerName,
        color: nextColor(),
        token: ownerToken,
        joinedAt: Date.now(),
    };
    const room = {
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
function joinRoom(inviteToken, userName) {
    const roomId = inviteIndex.get(inviteToken);
    if (!roomId)
        return null;
    const room = rooms.get(roomId);
    if (!room)
        return null;
    const userToken = (0, uuid_1.v4)();
    const userId = (0, uuid_1.v4)();
    const member = {
        userId,
        name: userName,
        color: nextColor(),
        token: userToken,
        joinedAt: Date.now(),
    };
    room.members.set(userId, member);
    return { roomId, userToken, userId, user: member };
}
function getRoom(roomId) {
    return rooms.get(roomId);
}
function getRoomByInvite(inviteToken) {
    const roomId = inviteIndex.get(inviteToken);
    if (!roomId)
        return undefined;
    return rooms.get(roomId);
}
function removeMember(roomId, userId) {
    const room = rooms.get(roomId);
    if (room) {
        room.members.delete(userId);
        if (room.members.size === 0) {
            rooms.delete(roomId);
        }
    }
}
function updateMemberPresence(roomId, userId, currentFile, currentLine) {
    const room = rooms.get(roomId);
    if (!room)
        return;
    const member = room.members.get(userId);
    if (!member)
        return;
    if (currentFile !== undefined)
        member.currentFile = currentFile;
    if (currentLine !== undefined)
        member.currentLine = currentLine;
}
function getMembers(roomId) {
    const room = rooms.get(roomId);
    if (!room)
        return [];
    return Array.from(room.members.values());
}
function validateToken(roomId, token) {
    const room = rooms.get(roomId);
    if (!room)
        return null;
    for (const member of room.members.values()) {
        if (member.token === token)
            return member;
    }
    return null;
}
function isOwner(roomId, token) {
    const room = rooms.get(roomId);
    return room?.ownerToken === token;
}
