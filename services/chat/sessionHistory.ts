/**
 * Local chat session history
 * Stores lightweight metadata (id, title, timestamp) in AsyncStorage.
 * No full message storage — just the index for the sidebar "Recents" list.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mello/chat_sessions';
const MAX_SESSIONS = 50;

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string; // ISO date string
}

export async function getSessions(): Promise<ChatSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function upsertSession(id: string, title: string): Promise<void> {
  try {
    const sessions = await getSessions();
    const idx = sessions.findIndex((s) => s.id === id);
    const entry: ChatSession = { id, title, updatedAt: new Date().toISOString() };
    if (idx >= 0) {
      sessions[idx] = entry;
    } else {
      sessions.unshift(entry);
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // Non-fatal
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const sessions = await getSessions();
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify(sessions.filter((s) => s.id !== id))
    );
  } catch {}
}

export function formatSessionTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: days > 365 ? 'numeric' : undefined,
  });
}
