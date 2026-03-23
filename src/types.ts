export interface UserInfo {
  userId: string;
  name: string;
  color: string;
  token: string;
}

export interface Member extends UserInfo {
  joinedAt: number;
  currentFile?: string;
  currentLine?: number;
}

export interface Room {
  roomId: string;
  ownerToken: string;
  inviteToken: string;
  members: Map<string, Member>;
  createdAt: number;
}

export interface CommitEntry {
  id: string;
  author: string;
  files: string[];
  diff: string;
  timestamp: number;
  roomId: string;
}

export interface ChangeEvent {
  userId: string;
  userName: string;
  file: string;
  action: 'edit' | 'create' | 'delete';
  diff: string;
  timestamp: number;
}

export type NotificationLevel = 'all' | 'saves' | 'off';
