/**
 * userMemoryDigest — past-session "memory" the chat agent uses for
 * cross-session continuity, sourced from Supabase via
 * `chatService.getChats` / `getChat`.
 *
 * Why this layer exists:
 *   The Profile-tab `Memory` toggle was the contract: ON means "the
 *   companion remembers across sessions", OFF means "every session is
 *   a clean slate." The full transcript would blow the context window;
 *   each chat row already carries a `title` and a `summary` field, so
 *   we feed those (titles + summaries of the last N sessions) into
 *   the system prompt as a digest. Cheap to render, recurring themes
 *   stay visible, no quoting of raw user text.
 *
 * Quick on/off:
 *   `buildUserMemoryAddendum` short-circuits on
 *   `memory_enabled === false` BEFORE touching the cache. Toggling the
 *   memory row flips a boolean in `profilePreferences` cache; the
 *   very next `sendToBedrock` call honors it. No cache invalidation
 *   needed — the cache stays warm so re-enabling memory doesn't
 *   trigger a fresh Supabase round-trip.
 *
 * Hydration:
 *   `ensureUserMemoryHydrated()` is fire-and-forget on chat send. It
 *   guards against re-entrant fetches (one in-flight at a time) and
 *   has a 5-minute TTL so it doesn't hammer Supabase on every send.
 *   First send after launch incurs one network round-trip; the
 *   addendum is null until the fetch lands, which the model handles
 *   gracefully.
 *
 * Privacy:
 *   On signOut, `clearUserMemoryCache()` wipes the cache so user A's
 *   chat history doesn't leak into user B's session on a shared
 *   device. Wired into AuthContext alongside the other clears.
 */

import { getChats, getChat, type Chat, type ChatListItem } from './chatService';
import { getSession } from '@/services/auth';
import { getProfilePreferencesSync } from '@/utils/profilePreferences';

const TTL_MS = 5 * 60 * 1000;
const MAX_SESSIONS = 5;
const SUMMARY_CHAR_CAP = 140;

interface DigestEntry {
  title: string;
  summary: string | null;
  updatedAt: string;
}

interface CacheState {
  entries: DigestEntry[];
  fetchedAt: number;
}

let cache: CacheState | null = null;
let inFlight: Promise<void> | null = null;
/* When `inFlight` was started. A pathologically slow fetch (network
 * hung, server didn't respond) shouldn't block fresh refresh attempts
 * forever — clamp the in-flight guard to a hard ceiling. */
let inFlightStartedAt = 0;
const INFLIGHT_MAX_MS = 30_000;

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'recently';
  const ms = Date.now() - t;
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'a week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return 'a month ago';
  return `${Math.floor(days / 30)} months ago`;
}

function clipSummary(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (trimmed.length <= SUMMARY_CHAR_CAP) return trimmed;
  return trimmed.slice(0, SUMMARY_CHAR_CAP - 1).trimEnd() + '…';
}

/* Best-effort fetch. Pulls the most-recent N chats from Supabase, then
 * loads each row's full record (`getChat` reuses the same cached array
 * so the second call is local). Failures leave the previous cache
 * intact; null cache stays null and the addendum returns null. */
async function refresh(): Promise<void> {
  // Single-flight guard with TTL — if a previous in-flight fetch has
  // been running longer than INFLIGHT_MAX_MS, treat it as stuck and
  // start a fresh attempt rather than blocking forever.
  if (inFlight && Date.now() - inFlightStartedAt < INFLIGHT_MAX_MS) {
    return inFlight;
  }
  inFlightStartedAt = Date.now();
  inFlight = (async () => {
    try {
      // Pass the real userId rather than the empty-string sentinel.
      // `chatService.getChats` ignores the param today (uses internal
      // getAuth), but a future refactor could honor it — passing
      // truth here makes that refactor a non-event.
      const session = await getSession();
      const userId = session?.userId ?? '';
      const list: ChatListItem[] = await getChats(userId, MAX_SESSIONS);
      // getChat resolves against the same internal cache, so this is
      // not N round-trips — just N hits to the in-memory array.
      const rows: (Chat | null)[] = await Promise.all(
        list.slice(0, MAX_SESSIONS).map((c) => getChat(c.id)),
      );
      const entries: DigestEntry[] = rows
        .filter((r): r is Chat => r !== null)
        .map((r) => ({
          title: r.title || 'untitled',
          summary: clipSummary(r.summary),
          updatedAt: r.updated_at,
        }));
      cache = { entries, fetchedAt: Date.now() };
    } catch (err) {
      console.warn('[userMemoryDigest] refresh failed', err);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Lazy hydrate. Returns immediately if cache is fresh OR memory is
 *  off (zero work in either case). Otherwise kicks a background
 *  fetch. Caller must NOT await for blocking — fire and forget. */
export function ensureUserMemoryHydrated(): void {
  const prefs = getProfilePreferencesSync();
  if (prefs?.memory_enabled === false) return; // off — don't fetch
  const fresh = cache && Date.now() - cache.fetchedAt < TTL_MS;
  if (fresh) return;
  void refresh();
}

/** Build the system-prompt addendum, or null when:
 *   - memory_enabled === false (quick off-switch), OR
 *   - cache is empty (first launch, fetch hasn't landed yet). */
export function buildUserMemoryAddendum(): string | null {
  const prefs = getProfilePreferencesSync();
  if (prefs?.memory_enabled === false) return null;
  if (!cache || cache.entries.length === 0) return null;

  const lines = cache.entries.map((e) => {
    const when = relativeTime(e.updatedAt);
    const main = `"${e.title}" (${when})`;
    return e.summary ? `- ${main}: ${e.summary}` : `- ${main}`;
  });

  return [
    'Past sessions with this user (use to notice recurring themes; do NOT quote any of this back verbatim):',
    ...lines,
  ].join('\n');
}

/** Wipe the cache. Call on signOut so user A's history doesn't leak
 *  into user B's session on a shared device. */
export function clearUserMemoryCache(): void {
  cache = null;
  inFlight = null;
  inFlightStartedAt = 0;
}
