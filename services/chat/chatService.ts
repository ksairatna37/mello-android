/**
 * Chat Service — row-shape against `public.chats` (post-migration).
 *
 * The backend now exposes proper row-per-chat endpoints (per /docs):
 *
 *   POST /rest/v1/upload/chat          insert one row, returns full row
 *   GET  /rest/v1/load/chat?user_id=X  array of public.chats rows desc
 *   POST /rest/v1/update/chat          update one row (body must include `id`)
 *
 *   No DELETE endpoint exists yet — `deleteChat` is a soft-stub that
 *   warns. Backend team to add `DELETE /chats?id=…` next.
 *
 * Public function signatures are unchanged so callers (ChatScreen,
 * ChatSidebar, ChatHistory, voiceChatService) don't move.
 *
 * Why row-shape now: backend used to write a JSON blob into
 * `user_onboarding.chat`. That god-table architecture rewrote the
 * whole user record on every save, broke multi-device sync, and
 * scaled badly. Backend migrated 2026-05-01; details + verification
 * curl runs are in `docs/BACKEND_GOD_TABLE_ISSUE.md`.
 */

import { authPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getAccessToken, getSession } from '@/services/auth';
import { generateChatTitle, generateChatSummary } from './bedrockService';
import type { BedrockMessage } from './bedrockService';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (public surface unchanged)
// ═══════════════════════════════════════════════════════════════════════════

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number; // Unix ms
}

export interface Chat {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  duration: number | null;
  conversation: ChatMessage[] | null;
  start_time: number | null;
  end_time: number | null;
  type: string | null;
  summary: string | null;
  is_starred?: boolean;
  feedback?: ChatFeedback;
}

export interface ChatListItem {
  id: string;
  title: string;
  updated_at: string;
  type: string | null;
  is_starred?: boolean;
}

export type ChatFeedback = 'liked' | 'disliked' | null;

// ═══════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════

async function getAuth(): Promise<{ token: string; userId: string } | null> {
  const token = await getAccessToken();
  const session = await getSession();
  if (!token || !session?.userId) {
    console.warn('[chatService] no auth — request skipped');
    return null;
  }
  return { token, userId: session.userId };
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE  (POST /upload/chat)
// ═══════════════════════════════════════════════════════════════════════════

export async function createChat(
  userId: string,
  type: 'textchat' | 'voicechat' = 'textchat',
): Promise<Chat | null> {
  console.log('=== CREATE CHAT === userId=' + userId.slice(0, 8) + '… type=' + type);
  const auth = await getAuth();
  if (!auth) return null;

  const body = {
    user_id: userId,
    title: 'New chat',
    type,
    conversation: [] as ChatMessage[],
    start_time: Date.now(),
    is_starred: false,
    feedback: null as ChatFeedback,
  };

  const { data, error } = await authPost<Chat, typeof body>(
    '/rest/v1/upload/chat',
    body,
    auth.token,
  );
  if (error || !data) {
    console.error('[chatService] createChat error:', error?.message);
    return null;
  }
  console.log('>>> Chat created:', data.id);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST + GET  (GET /load/chat)
// ═══════════════════════════════════════════════════════════════════════════

/** Single GET that returns every chat row for the user. We cache the
 *  raw response per call so `getChats` and a sibling `getChat` lookup
 *  don't double-fetch in tight succession. The cache is per-call (no
 *  TTL) — callers explicitly request fresh data each time. */
async function loadAllChats(): Promise<Chat[]> {
  const auth = await getAuth();
  if (!auth) return [];

  console.log('[chatService] loadAllChats → POST /load/chat user_id=' + auth.userId.slice(0, 8) + '…');
  const { data, error } = await authPost<Chat[], { user_id: string }>(
    '/rest/v1/load/chat',
    { user_id: auth.userId },
    auth.token,
  );
  if (error) {
    if (error.status === 404) return [];
    console.error('[chatService] loadAllChats error:', error.message);
    return [];
  }
  if (!Array.isArray(data)) {
    console.warn('[chatService] loadAllChats: unexpected response shape');
    return [];
  }
  return data;
}

export async function getChats(userId: string, limit = 50): Promise<ChatListItem[]> {
  console.log('=== GET CHATS === userId=' + userId.slice(0, 8) + '…');
  const rows = await loadAllChats();
  const items: ChatListItem[] = rows
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      title: c.title || 'New chat',
      updated_at: c.updated_at,
      type: c.type,
      is_starred: c.is_starred ?? false,
    }));
  console.log('>>> Found', items.length, 'chats');
  return items;
}

export async function getChat(chatId: string): Promise<Chat | null> {
  console.log('=== GET CHAT === id=' + chatId);
  const rows = await loadAllChats();
  const chat = rows.find((c) => c.id === chatId) ?? null;
  if (!chat) console.log('>>> getChat: not found');
  else console.log('>>> getChat: found, msgs=' + (chat.conversation?.length ?? 0));
  return chat;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE  (POST /update/chat)
// ═══════════════════════════════════════════════════════════════════════════

/** Thin helper — every mutation eventually goes through this. */
async function updateChat(
  chatId: string,
  patch: Partial<Omit<Chat, 'id' | 'user_id' | 'created_at'>>,
): Promise<Chat | null> {
  const auth = await getAuth();
  if (!auth) return null;

  const body = { id: chatId, user_id: auth.userId, ...patch };
  const { data, error } = await authPost<Chat, typeof body>(
    '/rest/v1/update/chat',
    body,
    auth.token,
  );
  if (error) {
    console.warn('[chatService] updateChat error:', error.message);
    return null;
  }
  return data ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD MESSAGE — append to conversation[] and PATCH-update the row
// ═══════════════════════════════════════════════════════════════════════════

export async function addMessage(
  chatId: string,
  role: 'user' | 'assistant',
  content: string,
  existingConversation: ChatMessage[] = [],
): Promise<ChatMessage[]> {
  console.log('=== ADD MESSAGE === id=' + chatId + ' role=' + role + ' len=' + content.length);

  const newMessage: ChatMessage = { role, content, timestamp: Date.now() };
  const updatedConversation = [...existingConversation, newMessage];

  await updateChat(chatId, { conversation: updatedConversation });
  console.log('>>> Message added, total:', updatedConversation.length);
  return updatedConversation;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE TITLE
// ═══════════════════════════════════════════════════════════════════════════

export async function updateTitle(chatId: string, title: string): Promise<void> {
  console.log('=== UPDATE TITLE === id=' + chatId + ' title=' + title);
  await updateChat(chatId, { title });
}

/**
 * Generate a short, descriptive title via the model and persist it.
 */
export async function generateAndSetTitle(
  chatId: string,
  conversation: ChatMessage[],
): Promise<string> {
  console.log('=== GENERATE TITLE === id=' + chatId);
  // bedrockService.generateChatTitle wants BedrockMessage[] shape
  // (content: [{ text }]), not raw ChatMessage[] (content: string).
  // Skipping the conversion produced "User: undefined / Mello: undefined"
  // prompts and useless one-size-fits-all titles.
  const title = await generateChatTitle(toBedrockFormat(conversation))
    .catch(() => 'New chat');
  await updateTitle(chatId, title || 'New chat');
  return title || 'New chat';
}

// ═══════════════════════════════════════════════════════════════════════════
// END CHAT — set end_time + duration; persist conversation
// ═══════════════════════════════════════════════════════════════════════════

export async function endChat(
  chatId: string,
  conversation: ChatMessage[],
  startTime: number | null,
): Promise<void> {
  console.log('=== END CHAT === id=' + chatId + ' msgs=' + conversation.length);
  const endTime = Date.now();
  const duration = startTime ? endTime - startTime : null;
  await updateChat(chatId, {
    conversation,
    end_time: endTime,
    duration,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

export async function generateAndSetSummary(
  chatId: string,
  conversation: ChatMessage[],
): Promise<string> {
  console.log('=== GENERATE SUMMARY === id=' + chatId);
  // Same shape conversion as generateAndSetTitle — bedrockService
  // expects BedrockMessage[] not ChatMessage[].
  const summary = await generateChatSummary(toBedrockFormat(conversation))
    .catch(() => '');
  if (summary) await updateChat(chatId, { summary });
  return summary || '';
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE — TEMPORARILY UNAVAILABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DELETE endpoint for chats does not exist yet in the backend (only
 * journal_entries has DELETE per /docs as of the 2026-05-01 migration).
 * Returns false so callers can show an "unsupported" hint to the user.
 * Backend ticket: add `DELETE /rest/v1/chats?user_id=…&id=…`.
 */
export async function deleteChat(chatId: string): Promise<boolean> {
  console.warn('[chatService] deleteChat — backend has no DELETE endpoint yet, no-op. id=' + chatId);
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// STAR
// ═══════════════════════════════════════════════════════════════════════════

export async function starChat(chatId: string, starred: boolean): Promise<void> {
  console.log('=== STAR CHAT === id=' + chatId + ' starred=' + starred);
  await updateChat(chatId, { is_starred: starred });
}

// ═══════════════════════════════════════════════════════════════════════════
// FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════

export async function updateChatFeedback(
  chatId: string,
  feedback: ChatFeedback,
): Promise<void> {
  console.log('=== UPDATE CHAT FEEDBACK === id=' + chatId + ' feedback=' + feedback);
  await updateChat(chatId, { feedback });
}

// ═══════════════════════════════════════════════════════════════════════════
// VOICE → CHAT BRIDGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Insert a finished voice session as a chat row. Called by
 * `finalizeVoiceSession` in `voiceChatService.ts`. Public only because
 * it crosses service boundaries.
 */
export async function addVoiceChatToBlob(args: {
  title: string;
  summary: string | null;
  conversation: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  startTime: number;
  endTime: number;
  duration: number;
}): Promise<void> {
  console.log('=== ADD VOICE CHAT === title=' + args.title);
  const auth = await getAuth();
  if (!auth) return;

  const body = {
    user_id: auth.userId,
    title: args.title,
    summary: args.summary,
    type: 'voicechat',
    conversation: args.conversation as ChatMessage[],
    start_time: args.startTime,
    end_time: args.endTime,
    duration: args.duration,
    is_starred: false,
    feedback: null as ChatFeedback,
  };
  const { data, error } = await authPost<Chat, typeof body>(
    '/rest/v1/upload/chat',
    body,
    auth.token,
  );
  if (error) {
    console.error('[chatService] addVoiceChatToBlob error:', error.message);
    return;
  }
  console.log('>>> Voice chat row created:', data?.id);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Convert ChatMessage[] → BedrockMessage[] for AI calls. */
export function toBedrockFormat(conversation: ChatMessage[]): BedrockMessage[] {
  return conversation.map((m) => ({
    role: m.role,
    content: [{ text: m.content }],
  }));
}

/** "today" / "yesterday" / "march 14" / "Mar 14, 2025" relative time. */
export function formatRelativeTime(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'yesterday';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(
    'en-US',
    sameYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  ).toLowerCase();
}
