import { CommitEntry, ChangeEvent } from './types';
import path from 'path';
import fse from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const commitBuffers = new Map<string, ChangeEvent[]>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 5000;

export type CommitListener = (commit: CommitEntry) => void;
const listeners: CommitListener[] = [];

export function onCommit(cb: CommitListener) {
  listeners.push(cb);
}

function notifyListeners(commit: CommitEntry) {
  for (const cb of listeners) cb(commit);
}

export async function bufferChange(event: ChangeEvent): Promise<void> {
  const { roomId } = event as ChangeEvent & { roomId: string };
  const key = (event as any).roomId as string;

  if (!commitBuffers.has(key)) commitBuffers.set(key, []);
  commitBuffers.get(key)!.push(event);

  const existing = timers.get(key);
  if (existing) clearTimeout(existing);

  const t = setTimeout(() => flushBuffer(key), DEBOUNCE_MS);
  timers.set(key, t);
}

async function flushBuffer(roomId: string): Promise<void> {
  const events = commitBuffers.get(roomId);
  if (!events || events.length === 0) return;
  commitBuffers.set(roomId, []);
  timers.delete(roomId);

  // Group by author + file
  const files = [...new Set(events.map((e) => e.file))];
  const authors = [...new Set(events.map((e) => e.userName))];
  const diffSnippet = events
    .slice(-3)
    .map((e) => `[${e.action}] ${e.file}: ${e.diff.substring(0, 80)}`)
    .join('\n');

  const commit: CommitEntry = {
    id: uuidv4(),
    author: authors.join(', '),
    files,
    diff: diffSnippet,
    timestamp: Date.now(),
    roomId,
  };

  await persistCommit(roomId, commit);
  notifyListeners(commit);
}

async function persistCommit(roomId: string, commit: CommitEntry): Promise<void> {
  const filePath = path.join(DATA_DIR, `${roomId}.json`);
  await fse.ensureDir(DATA_DIR);
  let existing: CommitEntry[] = [];
  if (await fse.pathExists(filePath)) {
    existing = await fse.readJson(filePath).catch(() => []);
  }
  existing.unshift(commit); // newest first
  // Keep at most 500 commits per room
  if (existing.length > 500) existing.length = 500;
  await fse.writeJson(filePath, existing, { spaces: 2 });
}

export async function getCommits(roomId: string): Promise<CommitEntry[]> {
  const filePath = path.join(DATA_DIR, `${roomId}.json`);
  if (!(await fse.pathExists(filePath))) return [];
  return fse.readJson(filePath).catch(() => []);
}
