import fetch from 'node-fetch';
import { CommitEntry } from './types';

export interface DiscordConfig {
  webhookUrl: string;
  level: 'all' | 'saves' | 'off';
}

const roomConfigs = new Map<string, DiscordConfig>();

export function setDiscordConfig(roomId: string, config: DiscordConfig): void {
  roomConfigs.set(roomId, config);
}

export function getDiscordConfig(roomId: string): DiscordConfig | undefined {
  return roomConfigs.get(roomId);
}

export async function sendCommitNotification(commit: CommitEntry): Promise<void> {
  const config = roomConfigs.get(commit.roomId);
  if (!config || config.level === 'off' || !config.webhookUrl) return;

  const embed = buildEmbed(commit);

  try {
    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) {
      console.error('[Discord] Failed to send webhook:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Discord] Webhook error:', err);
  }
}

function buildEmbed(commit: CommitEntry) {
  const fileList = commit.files.map((f) => `• \`${f}\``).join('\n') || '(no files)';
  const diffBlock = commit.diff
    ? `\`\`\`diff\n${commit.diff.substring(0, 800)}\n\`\`\``
    : '';

  return {
    title: '📝 Commit Watcher — New Changes',
    color: 0x4ecdc4,
    fields: [
      { name: '👤 Author', value: commit.author, inline: true },
      { name: '📁 Files', value: fileList, inline: false },
      ...(diffBlock ? [{ name: '🔍 Diff Preview', value: diffBlock, inline: false }] : []),
    ],
    footer: { text: `Room: ${commit.roomId.substring(0, 8)}… • ${new Date(commit.timestamp).toISOString()}` },
  };
}

export async function sendFileEventNotification(
  webhookUrl: string,
  userName: string,
  file: string,
  action: 'create' | 'delete',
): Promise<void> {
  if (!webhookUrl) return;
  const actionEmoji = action === 'create' ? '✅' : '🗑️';
  const embed = {
    title: `${actionEmoji} File ${action === 'create' ? 'Created' : 'Deleted'}`,
    color: action === 'create' ? 0x2ecc71 : 0xe74c3c,
    fields: [
      { name: '👤 User', value: userName, inline: true },
      { name: '📄 File', value: `\`${file}\``, inline: true },
    ],
    footer: { text: new Date().toISOString() },
  };
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (_) {}
}
