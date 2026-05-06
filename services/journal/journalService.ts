/**
 * Journal Service — row-shape against `public.journal_entries` (post-migration).
 *
 * The backend now exposes proper row-per-entry endpoints (per /docs):
 *
 *   POST   /rest/v1/journal_entries
 *          body: { user_id, content, source, title?, tags?, mood?,
 *                  chat_id?, chat_type? }
 *          → 201 inserted row (id + word_count auto-computed).
 *          For source='chat', backend upserts on (user_id, chat_id) so
 *          saving the same chat twice merges instead of erroring.
 *
 *   GET    /rest/v1/journal_entries?user_id=eq.<uid>[&source=...]
 *                                  [&chat_id=...][&limit=...]
 *          → array of public.journal_entries rows desc by created_at.
 *
 *   PATCH  /rest/v1/journal_entries?id=<uuid>
 *          body: { title?, content?, tags?, mood?, ... }
 *          → updated row. Server sets updated_at automatically.
 *
 *   DELETE /rest/v1/journal_entries?user_id=eq.<uid>&id=<uuid>
 *   DELETE /rest/v1/journal_entries?user_id=eq.<uid>&chat_id=<id>
 *          → { deleted: true }.
 *
 * Public function names match what the UI already uses, so
 * SelfMindJournalHome / SelfMindChatHistory / ChatScreen call sites
 * don't change. Saved-chat helpers wrap the row pattern with the
 * `source: 'chat'` + `chat_id` discipline.
 *
 * History note: pre-2026-05-01 the backend stored journal as a JSON
 * blob in `user_onboarding.journal`. See `docs/BACKEND_GOD_TABLE_ISSUE.md`
 * for the migration story.
 */

import { authGet, authPost, authPatch, authDelete } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getAccessToken, getSession } from '@/services/auth';

/* ─── Types ───────────────────────────────────────────────────────── */

export type JournalSource = 'voice' | 'text' | 'prompt' | 'chat';
export type JournalChatType = 'textchat' | 'voicechat';

export const SAVED_CHAT_TAG = 'saved-chat';

/** Row shape returned by the backend (column names = SQL columns). */
interface JournalRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  word_count: number;
  title: string | null;
  source: JournalSource;
  tags: string[] | null;
  mood: string | null;
  chat_id: string | null;
  chat_type: JournalChatType | null;
}

/** Public shape consumed by the UI (camel-cased mirror). */
export interface JournalEntry {
  id: string;
  createdAt: string;
  updatedAt?: string;
  title: string;
  body?: string;
  mood?: string;
  source: JournalSource;
  tags?: string[];
  chatId?: string;
  chatType?: JournalChatType | null;
  wordCount?: number;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/* ─── Helpers ─────────────────────────────────────────────────────── */

async function requireAuth(): Promise<
  { token: string; userId: string } | { error: string }
> {
  const token = await getAccessToken();
  const session = await getSession();
  if (!token || !session?.userId) {
    return { error: 'not authenticated' };
  }
  return { token, userId: session.userId };
}

function rowToEntry(r: JournalRow): JournalEntry {
  return {
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    title: r.title ?? deriveTitleFromContent(r.content),
    body: r.content,
    mood: r.mood ?? undefined,
    source: r.source,
    tags: r.tags ?? undefined,
    chatId: r.chat_id ?? undefined,
    chatType: r.chat_type ?? null,
    wordCount: r.word_count,
  };
}

function deriveTitleFromContent(content: string): string {
  const firstLine = (content || '').split('\n')[0].trim();
  if (!firstLine) return 'Untitled entry';
  return firstLine.length > 80 ? firstLine.slice(0, 77) + '…' : firstLine;
}

/* ─── Public API ──────────────────────────────────────────────────── */

/** GET all journal entries for the current user, newest first. */
export async function fetchEntries(opts?: {
  source?: JournalSource;
  chatId?: string;
  limit?: number;
}): Promise<Result<JournalEntry[]>> {
  const auth = await requireAuth();
  if ('error' in auth) return { ok: false, error: auth.error };

  const params = new URLSearchParams({ user_id: `eq.${auth.userId}` });
  if (opts?.source) params.set('source', opts.source);
  if (opts?.chatId) params.set('chat_id', opts.chatId);
  if (opts?.limit) params.set('limit', String(opts.limit));

  const url = `${ENDPOINTS.JOURNAL_ENTRIES}?${params.toString()}`;
  console.log('[journalService] fetchEntries → GET', url);
  const { data, error } = await authGet<JournalRow[]>(url, auth.token);

  if (error) {
    if (error.status === 404) {
      console.log('[journalService] fetchEntries — empty (404)');
      return { ok: true, data: [] };
    }
    console.warn('[journalService] fetchEntries error:', error.message);
    return { ok: false, error: error.message ?? 'fetch failed' };
  }

  const rows = Array.isArray(data) ? data : [];
  console.log('[journalService] fetchEntries ← rows=' + rows.length);
  return { ok: true, data: rows.map(rowToEntry) };
}

/**
 * POST a new entry. For source='chat' the backend upserts on
 * (user_id, chat_id) — saving the same chat twice merges in place.
 */
export async function addEntry(
  entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'wordCount'>,
): Promise<Result<JournalEntry>> {
  const auth = await requireAuth();
  if ('error' in auth) return { ok: false, error: auth.error };

  const body = {
    user_id: auth.userId,
    content: entry.body ?? '',
    source: entry.source,
    title: entry.title || deriveTitleFromContent(entry.body ?? ''),
    tags: entry.tags ?? null,
    mood: entry.mood ?? null,
    chat_id: entry.chatId ?? null,
    chat_type: entry.chatType ?? null,
  };

  console.log('[journalService] addEntry → source=' + body.source + ' chatId=' + (body.chat_id ?? '—'));
  const { data, error } = await authPost<JournalRow, typeof body>(
    ENDPOINTS.JOURNAL_ENTRIES,
    body,
    auth.token,
  );
  if (error || !data) {
    console.warn('[journalService] addEntry error:', error?.message);
    return { ok: false, error: error?.message ?? 'save failed' };
  }
  console.log('[journalService] addEntry ← id=' + data.id);
  return { ok: true, data: rowToEntry(data) };
}

/**
 * PATCH partial fields on an existing entry. Server sets updated_at.
 */
export async function patchEntry(
  id: string,
  patch: Partial<Pick<JournalEntry, 'title' | 'body' | 'mood' | 'tags'>>,
): Promise<Result<JournalEntry>> {
  const auth = await requireAuth();
  if ('error' in auth) return { ok: false, error: auth.error };

  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.body !== undefined) body.content = patch.body;
  if (patch.mood !== undefined) body.mood = patch.mood;
  if (patch.tags !== undefined) body.tags = patch.tags;

  const url = `${ENDPOINTS.JOURNAL_ENTRIES}?id=${encodeURIComponent(id)}`;
  console.log('[journalService] patchEntry → PATCH', url, Object.keys(body));
  const { data, error } = await authPatch<JournalRow, typeof body>(
    url,
    body,
    auth.token,
  );
  if (error || !data) {
    console.warn('[journalService] patchEntry error:', error?.message);
    return { ok: false, error: error?.message ?? 'patch failed' };
  }
  return { ok: true, data: rowToEntry(data) };
}

/** DELETE one entry by id. Idempotent — missing id returns success. */
export async function removeEntry(id: string): Promise<Result<true>> {
  const auth = await requireAuth();
  if ('error' in auth) return { ok: false, error: auth.error };

  const url =
    `${ENDPOINTS.JOURNAL_ENTRIES}?user_id=eq.${auth.userId}&id=${encodeURIComponent(id)}`;
  console.log('[journalService] removeEntry → DELETE', url);
  const { error } = await authDelete<{ deleted: boolean }>(url, auth.token);
  if (error && error.status !== 404) {
    console.warn('[journalService] removeEntry error:', error.message);
    return { ok: false, error: error.message ?? 'delete failed' };
  }
  return { ok: true, data: true };
}

/* ─── Saved-chat helpers ──────────────────────────────────────────── */

/**
 * Save a chat-history thread as a journal entry. Idempotent — backend's
 * partial UNIQUE on (user_id, chat_id) WHERE source='chat' upserts.
 */
export async function saveChatAsEntry(args: {
  chatId: string;
  title: string;
  chatType?: JournalChatType | null;
  body?: string;
}): Promise<Result<JournalEntry>> {
  console.log('[journalService] saveChatAsEntry chatId=' + args.chatId);
  /* Backend requires non-empty `content` on every row regardless of
   * source. For saved chats we don't have a body — fall back to the
   * chat title so the column is human-readable if anyone scans the
   * table directly, with a generic placeholder if even the title is
   * empty (rare — chats always get an auto-generated title). */
  const title = args.title || 'Saved chat';
  const content =
    (args.body && args.body.trim().length > 0)
      ? args.body
      : `Saved chat — ${title}`;
  return addEntry({
    title,
    body: content,
    source: 'chat',
    tags: [SAVED_CHAT_TAG],
    chatId: args.chatId,
    chatType: args.chatType ?? null,
  });
}

/** Remove a previously-saved chat from the journal by chat_id. */
export async function unsaveChatEntry(chatId: string): Promise<Result<true>> {
  const auth = await requireAuth();
  if ('error' in auth) return { ok: false, error: auth.error };

  const url =
    `${ENDPOINTS.JOURNAL_ENTRIES}?user_id=eq.${auth.userId}&chat_id=${encodeURIComponent(chatId)}`;
  console.log('[journalService] unsaveChatEntry → DELETE', url);
  const { error } = await authDelete<{ deleted: boolean }>(url, auth.token);
  if (error && error.status !== 404) {
    console.warn('[journalService] unsaveChatEntry error:', error.message);
    return { ok: false, error: error.message ?? 'unsave failed' };
  }
  return { ok: true, data: true };
}

/** Quick lookup: is this chat already saved? Single-row server query. */
export async function isChatSaved(chatId: string): Promise<boolean> {
  const result = await fetchEntries({ source: 'chat', chatId, limit: 1 });
  if (!result.ok) return false;
  return result.data.length > 0;
}
