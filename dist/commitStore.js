"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onCommit = onCommit;
exports.bufferChange = bufferChange;
exports.getCommits = getCommits;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const uuid_1 = require("uuid");
const DATA_DIR = path_1.default.resolve(process.cwd(), 'data');
const commitBuffers = new Map();
const timers = new Map();
const DEBOUNCE_MS = 5000;
const listeners = [];
function onCommit(cb) {
    listeners.push(cb);
}
function notifyListeners(commit) {
    for (const cb of listeners)
        cb(commit);
}
async function bufferChange(event) {
    const { roomId } = event;
    const key = event.roomId;
    if (!commitBuffers.has(key))
        commitBuffers.set(key, []);
    commitBuffers.get(key).push(event);
    const existing = timers.get(key);
    if (existing)
        clearTimeout(existing);
    const t = setTimeout(() => flushBuffer(key), DEBOUNCE_MS);
    timers.set(key, t);
}
async function flushBuffer(roomId) {
    const events = commitBuffers.get(roomId);
    if (!events || events.length === 0)
        return;
    commitBuffers.set(roomId, []);
    timers.delete(roomId);
    // Group by author + file
    const files = [...new Set(events.map((e) => e.file))];
    const authors = [...new Set(events.map((e) => e.userName))];
    const diffSnippet = events
        .slice(-3)
        .map((e) => `[${e.action}] ${e.file}: ${e.diff.substring(0, 80)}`)
        .join('\n');
    const commit = {
        id: (0, uuid_1.v4)(),
        author: authors.join(', '),
        files,
        diff: diffSnippet,
        timestamp: Date.now(),
        roomId,
    };
    await persistCommit(roomId, commit);
    notifyListeners(commit);
}
async function persistCommit(roomId, commit) {
    const filePath = path_1.default.join(DATA_DIR, `${roomId}.json`);
    await fs_extra_1.default.ensureDir(DATA_DIR);
    let existing = [];
    if (await fs_extra_1.default.pathExists(filePath)) {
        existing = await fs_extra_1.default.readJson(filePath).catch(() => []);
    }
    existing.unshift(commit); // newest first
    // Keep at most 500 commits per room
    if (existing.length > 500)
        existing.length = 500;
    await fs_extra_1.default.writeJson(filePath, existing, { spaces: 2 });
}
async function getCommits(roomId) {
    const filePath = path_1.default.join(DATA_DIR, `${roomId}.json`);
    if (!(await fs_extra_1.default.pathExists(filePath)))
        return [];
    return fs_extra_1.default.readJson(filePath).catch(() => []);
}
