"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDiscordConfig = setDiscordConfig;
exports.getDiscordConfig = getDiscordConfig;
exports.sendCommitNotification = sendCommitNotification;
exports.sendFileEventNotification = sendFileEventNotification;
const node_fetch_1 = __importDefault(require("node-fetch"));
const roomConfigs = new Map();
function setDiscordConfig(roomId, config) {
    roomConfigs.set(roomId, config);
}
function getDiscordConfig(roomId) {
    return roomConfigs.get(roomId);
}
async function sendCommitNotification(commit) {
    const config = roomConfigs.get(commit.roomId);
    if (!config || config.level === 'off' || !config.webhookUrl)
        return;
    const embed = buildEmbed(commit);
    try {
        const res = await (0, node_fetch_1.default)(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
        });
        if (!res.ok) {
            console.error('[Discord] Failed to send webhook:', res.status, await res.text());
        }
    }
    catch (err) {
        console.error('[Discord] Webhook error:', err);
    }
}
function buildEmbed(commit) {
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
async function sendFileEventNotification(webhookUrl, userName, file, action) {
    if (!webhookUrl)
        return;
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
        await (0, node_fetch_1.default)(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
        });
    }
    catch (_) { }
}
