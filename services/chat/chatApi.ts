/**
 * Chat Persistence API
 * Loads and saves chat history via the Mello backend.
 *
 * Endpoints:
 *   POST /rest/v1/load/chat   — fetch stored messages for a user
 *   POST /rest/v1/update/chat — save/overwrite messages for a user
 *
 * Note: /upload/chat has known backend issues, so we use /update/chat
 * for both initial save and subsequent updates.
 */

import { authPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  is_init: boolean;
  sequence: number;
}

interface ChatPayload {
  messages: StoredMessage[];
}

interface LoadChatRequest {
  user_id: string;
}

interface SaveChatRequest {
  user_id: string;
  chat: ChatPayload;
}

// ═══════════════════════════════════════════════════
// LOAD
// ═══════════════════════════════════════════════════

/**
 * Load stored chat history for a user.
 * Returns array of messages, or null if no history found.
 */
export async function loadChat(
  userId: string,
  accessToken: string
): Promise<StoredMessage[] | null> {
  try {
    const response = await authPost<ChatPayload, LoadChatRequest>(
      ENDPOINTS.LOAD_CHAT,
      { user_id: userId },
      accessToken
    );

    if (response.error || !response.data) {
      return null;
    }

    const messages = response.data?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }

    return messages;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════════════

/**
 * Save (overwrite) chat history for a user.
 * Uses /update/chat for both new and existing chats.
 * Failures are silent — chat works even if persistence fails.
 */
export async function saveChat(
  userId: string,
  accessToken: string,
  messages: StoredMessage[]
): Promise<void> {
  try {
    await authPost<unknown, SaveChatRequest>(
      ENDPOINTS.UPDATE_CHAT,
      {
        user_id: userId,
        chat: { messages },
      },
      accessToken
    );
  } catch {
    // Persistence failure is non-fatal — the conversation continues locally
  }
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

/**
 * Convert app-internal Message[] to the backend StoredMessage[] format.
 * Skips the welcome message (id === 'welcome').
 */
export function toStoredMessages(
  messages: { id: string; text: string; isUser: boolean }[]
): StoredMessage[] {
  return messages
    .filter((m) => m.id !== 'welcome')
    .map((m, idx) => ({
      role: m.isUser ? 'user' : 'assistant',
      content: m.text,
      is_init: idx === 0,
      sequence: idx + 1,
    }));
}

/**
 * Convert backend StoredMessage[] back to the app-internal Message[] format.
 */
export function fromStoredMessages(
  stored: StoredMessage[]
): { id: string; text: string; isUser: boolean; timestamp: Date }[] {
  return stored.map((m, idx) => ({
    id: `stored_${idx}`,
    text: m.content,
    isUser: m.role === 'user',
    timestamp: new Date(),
  }));
}
