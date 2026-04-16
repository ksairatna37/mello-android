/**
 * Chat Service - Production Level
 *
 * Handles all chat operations with Supabase:
 * - Create/load/update chats
 * - Full conversation memory (AI remembers everything)
 * - Auto-generate title, summary, duration on chat end
 *
 * Schema: public.chats
 * - id, user_id, title, created_at, updated_at
 * - duration, conversation (JSON), start_time, end_time
 * - type, summary
 */

import { supabase } from '@/lib/supabase';
import { generateChatTitle, generateChatSummary } from './bedrockService';
import type { BedrockMessage } from './bedrockService';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number; // Unix timestamp ms
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
}

export interface ChatListItem {
  id: string;
  title: string;
  updated_at: string;
  type: string | null;
  is_starred?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE CHAT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new chat session
 */
export async function createChat(userId: string, type: 'textchat' | 'voicechat' = 'textchat'): Promise<Chat | null> {
  const startTime = Date.now();

  console.log('=== CREATE CHAT ===');
  console.log('>>> userId:', userId, 'type:', type, 'start_time:', startTime);

  const { data, error } = await supabase
    .from('chats')
    .insert({
      user_id: userId,
      title: 'New chat',
      type,
      start_time: startTime,   // bigint — ms since epoch
      conversation: [],
    })
    .select()
    .single();

  if (error) {
    console.error('>>> createChat error:', error);
    return null;
  }

  console.log('>>> Chat created:', data.id, 'start_time:', data.start_time);
  return data as Chat;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET CHATS (FOR SIDEBAR)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all chats for a user (sidebar list)
 * Returns lightweight list sorted by most recent
 */
export async function getChats(userId: string, limit = 50): Promise<ChatListItem[]> {
  console.log('=== GET CHATS ===');

  const { data, error } = await supabase
    .from('chats')
    .select('id, title, updated_at, type, is_starred')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('>>> getChats error:', error);
    return [];
  }

  console.log('>>> Found', data?.length || 0, 'chats');
  return (data || []).map(chat => ({
    id: chat.id,
    title: chat.title || 'New chat',
    updated_at: chat.updated_at,
    type: chat.type,
    is_starred: chat.is_starred ?? false,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE CHAT (WITH MESSAGES)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load a specific chat with full conversation history
 */
export async function getChat(chatId: string): Promise<Chat | null> {
  console.log('=== GET CHAT ===');
  console.log('>>> chatId:', chatId);

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single();

  if (error) {
    console.error('>>> getChat error:', error);
    return null;
  }

  console.log('>>> Loaded chat with', (data.conversation as ChatMessage[])?.length || 0, 'messages');
  return data as Chat;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD MESSAGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Add a message to conversation and update the chat
 * Returns the updated conversation for immediate use
 */
export async function addMessage(
  chatId: string,
  role: 'user' | 'assistant',
  content: string,
  existingConversation: ChatMessage[] = []
): Promise<ChatMessage[]> {
  console.log('=== ADD MESSAGE ===');
  console.log('>>> chatId:', chatId, 'role:', role, 'content length:', content.length);

  const newMessage: ChatMessage = {
    role,
    content,
    timestamp: Date.now(),
  };

  const updatedConversation = [...existingConversation, newMessage];

  const { error } = await supabase
    .from('chats')
    .update({
      conversation: updatedConversation,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chatId);

  if (error) {
    console.error('>>> addMessage error:', error);
  } else {
    console.log('>>> Message added, total:', updatedConversation.length);
  }

  return updatedConversation;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE TITLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update chat title (can be called with AI-generated title)
 */
export async function updateTitle(chatId: string, title: string): Promise<void> {
  console.log('=== UPDATE TITLE ===');
  console.log('>>> chatId:', chatId, 'title:', title);

  const { error } = await supabase
    .from('chats')
    .update({ title })
    .eq('id', chatId);

  if (error) {
    console.error('>>> updateTitle error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE & SET TITLE (AI)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate title using AI and update the chat
 * Call this after first AI response
 */
export async function generateAndSetTitle(
  chatId: string,
  conversation: ChatMessage[]
): Promise<string> {
  console.log('=== GENERATE & SET TITLE ===');

  // Convert to Bedrock format
  const bedrockMessages: BedrockMessage[] = conversation.map(m => ({
    role: m.role,
    content: [{ text: m.content }],
  }));

  // Generate title via AI
  const aiTitle = await generateChatTitle(bedrockMessages);

  // Fallback to first user message truncated
  const firstUserMsg = conversation.find(m => m.role === 'user')?.content || 'New chat';
  const fallback = firstUserMsg.length > 40
    ? firstUserMsg.slice(0, 40).trimEnd() + '...'
    : firstUserMsg;

  const title = aiTitle || fallback;

  await updateTitle(chatId, title);
  console.log('>>> Title set:', title);

  return title;
}

// ═══════════════════════════════════════════════════════════════════════════
// END CHAT (FINALIZE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Finalize chat when user ends or leaves.
 *
 * Micro-tasks fired as background (non-blocking):
 *   1. Re-generate title from full conversation (more accurate than first-exchange title)
 *   2. Generate summary
 *
 * Blocking write:
 *   - end_time, duration in one Supabase update
 */
export async function endChat(
  chatId: string,
  conversation: ChatMessage[],
  startTime: number
): Promise<void> {
  console.log('=== END CHAT ===');
  console.log('>>> chatId:', chatId, 'messages:', conversation.length);

  if (conversation.length === 0) {
    console.log('>>> Empty conversation, skipping endChat');
    return;
  }

  const endTime = Date.now();
  // startTime may be 0 for chats that predated our schema — guard against negative duration
  const duration = startTime > 0 ? endTime - startTime : null;

  // ── Background micro-tasks ─────────────────────────────────────────────
  // Re-generate title with full conversation (better accuracy than first-exchange)
  generateAndSetTitle(chatId, conversation).then((title) => {
    console.log('>>> [endChat] Final title set:', title);
  });

  // Generate summary once at the end
  generateAndSetSummary(chatId, conversation);

  // ── Write end metrics ──────────────────────────────────────────────────
  const { error } = await supabase
    .from('chats')
    .update({
      end_time: endTime,
      ...(duration !== null && { duration }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', chatId);

  if (error) {
    console.error('>>> endChat error:', error);
  } else {
    console.log('>>> Chat ended. Duration:', duration ? Math.round(duration / 1000) + 's' : 'unknown');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE & SET SUMMARY (AI)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate summary using AI and update the chat
 * Called when chat ends
 */
export async function generateAndSetSummary(
  chatId: string,
  conversation: ChatMessage[]
): Promise<void> {
  console.log('=== GENERATE & SET SUMMARY ===');

  if (conversation.length < 2) {
    console.log('>>> Too short for summary');
    return;
  }

  // Convert to Bedrock format
  const bedrockMessages: BedrockMessage[] = conversation.map(m => ({
    role: m.role,
    content: [{ text: m.content }],
  }));

  const summary = await generateChatSummary(bedrockMessages);

  if (summary) {
    const { error } = await supabase
      .from('chats')
      .update({ summary })
      .eq('id', chatId);

    if (error) {
      console.error('>>> setSummary error:', error);
    } else {
      console.log('>>> Summary set:', summary.substring(0, 100) + '...');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE CHAT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Delete a chat
 */
export async function deleteChat(chatId: string): Promise<boolean> {
  console.log('=== DELETE CHAT ===');
  console.log('>>> chatId:', chatId);

  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId);

  if (error) {
    console.error('>>> deleteChat error:', error);
    return false;
  }

  console.log('>>> Chat deleted');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// STAR CHAT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Toggle star on a chat.
 * Requires an `is_starred` boolean column in the chats table.
 * SQL: ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS is_starred boolean DEFAULT false;
 */
export async function starChat(chatId: string, starred: boolean): Promise<void> {
  console.log('=== STAR CHAT ===', chatId, starred);
  const { error } = await supabase
    .from('chats')
    .update({ is_starred: starred, updated_at: new Date().toISOString() })
    .eq('id', chatId);
  if (error) console.error('>>> starChat error:', error);
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT FEEDBACK (like / dislike)
// ═══════════════════════════════════════════════════════════════════════════

export type ChatFeedback = 'liked' | 'disliked' | null;

/**
 * Store overall chat feedback (thumbs up / down).
 * Requires a `feedback` text column in the chats table.
 * SQL: ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS feedback text;
 */
export async function updateChatFeedback(chatId: string, feedback: ChatFeedback): Promise<void> {
  console.log('=== CHAT FEEDBACK ===', chatId, feedback);
  const { error } = await supabase
    .from('chats')
    .update({ feedback, updated_at: new Date().toISOString() })
    .eq('id', chatId);
  if (error) console.error('>>> updateChatFeedback error:', error);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert conversation to Bedrock format for AI calls
 * This is how we maintain full memory - pass ALL messages
 */
export function toBedrockFormat(conversation: ChatMessage[]): BedrockMessage[] {
  return conversation.map(m => ({
    role: m.role,
    content: [{ text: m.content }],
  }));
}

/**
 * Format relative time for display
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
