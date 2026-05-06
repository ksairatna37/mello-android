/**
 * practiceProfileSync — single source of truth for practice-related
 * profile state in the SelfMind app.
 *
 * Backed by four columns on `public.profiles` (added by migration):
 *   practice_liked         text[]
 *   practice_stats         jsonb
 *   practice_last_used_at  jsonb
 *   practice_ui_hints      jsonb
 *
 * Why a module-level cache instead of AsyncStorage:
 *   The product rule is "nothing local for practice data." This file
 *   keeps an in-memory snapshot of the four columns so reads are
 *   synchronous + zero-latency (instant heart-fill on tap, instant
 *   skeleton state on screen mount), while writes round-trip to the
 *   server via PATCH /rest/v1/profiles. The cache is reseeded from
 *   the server every time AuthContext refetches the profile, so
 *   cross-device changes propagate on the next focus.
 *
 * Optimistic-UI contract:
 *   - Mutators (setLiked, recordSession, markHintSeen, etc.) update
 *     the in-memory cache synchronously and return the new value.
 *   - The PATCH fires async in the background.
 *   - On PATCH failure we DO NOT roll back automatically — the next
 *     refreshProfile() call will reconcile from server truth. This
 *     trades a small drift window for jank-free taps; the alternative
 *     (await PATCH before flipping the heart) feels broken on flaky
 *     networks.
 *   - Writes are coalesced through a single per-field debounce so a
 *     user spamming the heart doesn't trigger N PATCH calls.
 *
 * Concurrency:
 *   JS is single-threaded so cache reads/writes are atomic. Inflight
 *   PATCH calls are tracked per-field; if a new mutation lands while
 *   one is flying, we abort and re-fire with the latest snapshot.
 *
 * Lifecycle:
 *   AuthContext calls `seedFromProfile(profile)` after every successful
 *   fetchProfile / refreshProfile. On sign-out the cache is wiped via
 *   `clearCache()` so a different user opening the app doesn't see
 *   stale practice state from the previous session.
 */

import { useSyncExternalStore } from 'react';
import { ENDPOINTS } from '@/api/endpoints';
import { authPatch } from '@/api/client';
import { getAccessToken } from '@/services/auth/authStorage';
import type {
  ProfileResponse,
  PracticeStatsMap,
  PracticeLastUsedAtMap,
  PracticeUiHintsMap,
  PracticeCounters,
  UpdateProfileRequest,
} from '@/api/types';

// ─── Cache ──────────────────────────────────────────────────────────

interface PracticeCache {
  /** Profile id the cache was seeded from. Null until first seed. */
  profileId: string | null;
  liked: string[];
  stats: PracticeStatsMap;
  lastUsedAt: PracticeLastUsedAtMap;
  uiHints: PracticeUiHintsMap;
}

const cache: PracticeCache = {
  profileId: null,
  liked: [],
  stats: {},
  lastUsedAt: {},
  uiHints: {},
};

/** Subscriber pattern so React components that read from the cache
 *  can re-render when the cache changes (e.g. after a server refetch).
 *  Lightweight pub/sub matching the existing utils/*Store.ts pattern. */
type Subscriber = () => void;
const subscribers = new Set<Subscriber>();

function emit(): void {
  for (const sub of subscribers) {
    try { sub(); } catch (err) { console.warn('[practiceProfileSync] subscriber error', err); }
  }
}

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// ─── Retry-exhaustion telemetry ─────────────────────────────────────
//
// When `flushField` exhausts all retries for a given field, the cache
// holds an optimistic value the server doesn't have. The next
// refreshProfile reconciles, but until then there's a server↔client
// drift the user can't see. We expose a subscribable counter so
// debug screens / future telemetry / a banner can surface "your
// last save couldn't sync" without spelunking console logs.

interface RetryFailure {
  field: FieldKey;
  /** Wall-clock time the final attempt gave up. */
  at: number;
  /** Last observed error message (truncated). */
  lastError: string;
}

interface SyncTelemetryState {
  /** Total flushes that exhausted retries since process start. */
  exhaustionCount: number;
  /** The most recent N exhaustion events (capped — we don't grow
   *  unbounded). Newest first. */
  recentFailures: RetryFailure[];
}

const TELEMETRY_RECENT_CAP = 8;
const EMPTY_TELEMETRY: Readonly<SyncTelemetryState> = Object.freeze({
  exhaustionCount: 0,
  recentFailures: [] as RetryFailure[],
});

/** Telemetry singleton. CRITICAL: this is `let`, not `const`, and is
 *  REASSIGNED (not mutated in place) on every change. `useSyncTelemetry`
 *  passes the current value as the snapshot to React, and React's
 *  `useSyncExternalStore` bails on re-render when getSnapshot returns
 *  the same Object.is reference. Mutating-in-place would silently
 *  break every consumer. */
let telemetry: Readonly<SyncTelemetryState> = EMPTY_TELEMETRY;
const telemetrySubscribers = new Set<Subscriber>();

function emitTelemetry(): void {
  for (const sub of telemetrySubscribers) {
    try { sub(); } catch (err) { console.warn('[practiceProfileSync] telemetry subscriber error', err); }
  }
}

/** Strip strings that look like UUIDs, emails, or bearer-ish tokens
 *  out of a server error message before we stash it in the telemetry
 *  buffer (which a debug screen / banner may render). Belt-and-braces
 *  — backend errors shouldn't echo PII, but we don't want a stray
 *  payload fragment to leak through if they ever do. */
function redactErrorForTelemetry(s: string): string {
  return s
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[redacted-email]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[redacted-uuid]')
    .replace(/(?:bearer\s+|token=|access_token=)[A-Za-z0-9._-]{12,}/gi, '[redacted-token]')
    .slice(0, 200);
}

function recordRetryExhaustion(field: FieldKey, lastError: string): void {
  telemetry = {
    exhaustionCount: telemetry.exhaustionCount + 1,
    recentFailures: [
      { field, at: Date.now(), lastError: redactErrorForTelemetry(lastError) },
      ...telemetry.recentFailures,
    ].slice(0, TELEMETRY_RECENT_CAP),
  };
  emitTelemetry();
}

/** Read the current telemetry snapshot synchronously. */
export function getSyncTelemetry(): Readonly<SyncTelemetryState> {
  return telemetry;
}

/** Subscribe to telemetry changes (separate channel from cache
 *  subscribers so a banner that watches failures doesn't re-render
 *  on every heart-tap). */
export function subscribeTelemetry(fn: Subscriber): () => void {
  telemetrySubscribers.add(fn);
  return () => telemetrySubscribers.delete(fn);
}

/** React hook for telemetry — for a debug screen / failure banner.
 *  Re-renders on each `recordRetryExhaustion` / `resetSyncTelemetry`
 *  because those reassign the singleton; React sees a fresh ref. */
export function useSyncTelemetry(): Readonly<SyncTelemetryState> {
  return useSyncExternalStore(
    (cb) => subscribeTelemetry(cb),
    () => telemetry,
    () => telemetry,
  );
}

/** Manually clear telemetry (after a successful refreshProfile
 *  reconciles, after sign-out, or a debug-screen "dismiss" tap). */
export function resetSyncTelemetry(): void {
  if (telemetry === EMPTY_TELEMETRY) return;
  telemetry = EMPTY_TELEMETRY;
  emitTelemetry();
}

// ─── Seed / clear ───────────────────────────────────────────────────

/** True when a field has a debounced or inflight PATCH carrying
 *  unconfirmed local mutations. Used by `seedFromProfile` to avoid
 *  clobbering optimistic writes that haven't reached the server yet. */
function fieldHasPending(field: FieldKey): boolean {
  return Boolean(debounceTimers[field]) || Boolean(inflightControllers[field]);
}

/** Seed the cache from a freshly-fetched profile.
 *
 *  CRITICAL: per-field skip when a local mutation is pending or
 *  inflight. Without this, a refreshProfile arriving between a
 *  cache-mutate and its corresponding PATCH would overwrite the
 *  optimistic value with stale server state, the PATCH would then
 *  read the clobbered cache and ship the stale value, and the user's
 *  action is silently destroyed. (Real scenario: box-breath finishes
 *  cycles + 5 → cache.totalCycles=15 → focus event triggers
 *  refreshProfile → server still has 10 because PATCH hasn't fired
 *  → without per-field skip, cache becomes 10 again and the +5 is
 *  lost.)
 *
 *  Trade-off: fields with pending writes carry STALE server state
 *  for one refresh cycle longer. That's the right call — losing
 *  user actions is unrecoverable; staleness self-heals on the next
 *  refresh after the PATCH lands. */
export function seedFromProfile(profile: ProfileResponse | null): void {
  if (!profile?.id) {
    /* Defensive log — a profile object without `id` is malformed
     * upstream. We treat it as a sign-out (cache must not survive)
     * but flag it so the next engineer can chase the source. */
    if (profile && !profile.id) {
      console.warn('[practiceProfileSync] seedFromProfile got a profile with no id — clearing cache');
    }
    clearCache();
    return;
  }
  const nextLiked = profile.practice_liked ?? [];
  const nextStats = profile.practice_stats ?? {};
  const nextLastUsed = profile.practice_last_used_at ?? {};
  const nextHints = profile.practice_ui_hints ?? {};

  /* Per-field skip on pending mutations. */
  const skipLiked = fieldHasPending('practice_liked');
  const skipStats = fieldHasPending('practice_stats');
  const skipLastUsed = fieldHasPending('practice_last_used_at');
  const skipHints = fieldHasPending('practice_ui_hints');

  if (skipLiked || skipStats || skipLastUsed || skipHints) {
    console.log('[practiceProfileSync] seed skipping pending fields:'
      + (skipLiked ? ' liked' : '')
      + (skipStats ? ' stats' : '')
      + (skipLastUsed ? ' lastUsed' : '')
      + (skipHints ? ' hints' : ''));
  }

  /* Dirty check vs. the fields we're actually going to overwrite. */
  const changed =
    cache.profileId !== profile.id ||
    (!skipLiked && !sameArray(cache.liked, nextLiked)) ||
    (!skipStats && !sameJson(cache.stats, nextStats)) ||
    (!skipLastUsed && !sameJson(cache.lastUsedAt, nextLastUsed)) ||
    (!skipHints && !sameJson(cache.uiHints, nextHints));

  cache.profileId = profile.id;
  if (!skipLiked)    cache.liked = [...nextLiked];
  if (!skipStats)    cache.stats = { ...nextStats };
  if (!skipLastUsed) cache.lastUsedAt = { ...nextLastUsed };
  if (!skipHints)    cache.uiHints = { ...nextHints };

  if (changed) {
    console.log('[practiceProfileSync] seeded · liked=' + (skipLiked ? '(skip)' : nextLiked.length) + ' stats=' + (skipStats ? '(skip)' : Object.keys(nextStats).length) + ' lastUsed=' + (skipLastUsed ? '(skip)' : Object.keys(nextLastUsed).length) + ' hints=' + (skipHints ? '(skip)' : Object.keys(nextHints).length));
    emit();
  }

  /* If we successfully reseeded with NO skipped fields, the cache
   * matches server truth — clear retry-exhaustion telemetry. We do
   * NOT clear when fields were skipped: those fields still carry
   * unconfirmed local state, and any prior exhaustion against them
   * is still relevant.
   *
   * INVARIANT: this clearing is correct because retry exhaustion in
   * `flushField` deletes `inflightControllers[field]` (line where
   * the GAVE-UP branch runs), so `fieldHasPending(field)` returns
   * false at the next reseed and we don't skip. If a future edit
   * keeps the inflight controller around to suppress further
   * retries (or adds an "exhausted" sticky state that suppresses
   * the controller delete), THIS RESET BECOMES STALE — it would
   * clear telemetry for a field that's still server-divergent.
   * Audit this comment + flushField together. */
  if (!skipLiked && !skipStats && !skipLastUsed && !skipHints) {
    if (telemetry.exhaustionCount > 0) {
      console.log('[practiceProfileSync] reseed reconciled · clearing exhaustion telemetry');
      resetSyncTelemetry();
    }
  }
}

/** Wipe the cache. Call on sign-out / user switch. */
export function clearCache(): void {
  /* Reset telemetry FIRST — this is unconditional (even if the
   * cache was already null) because telemetry can outlive the cache
   * lifecycle. A previous user's exhaustion failures (with their
   * possibly-PII-tinted error messages) must NOT survive into the
   * next user's session. */
  resetSyncTelemetry();

  if (cache.profileId === null) return;
  console.log('[practiceProfileSync] cleared');
  cache.profileId = null;
  cache.liked = [];
  cache.stats = {};
  cache.lastUsedAt = {};
  cache.uiHints = {};
  emit();
}

// ─── Synchronous reads ──────────────────────────────────────────────

export function getLikedSync(): ReadonlyArray<string> {
  return cache.liked;
}

export function isLikedSync(practiceId: string): boolean {
  return cache.liked.includes(practiceId);
}

export function getStatsSync(practiceId: string): PracticeCounters {
  return cache.stats[practiceId] ?? {};
}

export function getLastUsedAtSync(practiceId: string): string | null {
  return cache.lastUsedAt[practiceId] ?? null;
}

export function getHintSync(hintKey: string): boolean {
  return cache.uiHints[hintKey] === true;
}

// ─── React hooks (useSyncExternalStore-based) ───────────────────────
//
// These let any component re-render when the practice cache changes
// — from a local mutation, a refreshProfile reseed, or a sign-out
// clear. Without these, components that read sync values (e.g. the
// practice library reading liked ids on focus only) would miss
// cross-device updates landing while the screen is open.

/** Subscribe a component to liked-state changes. Returns the current
 *  list of liked practice ids; re-renders the caller when it changes. */
export function useLikedPractices(): ReadonlyArray<string> {
  return useSyncExternalStore(
    (cb) => subscribe(cb),
    () => cache.liked,
    () => cache.liked,
  );
}

/** Subscribe to a single practice's liked state. */
export function useIsPracticeLiked(practiceId: string): boolean {
  return useSyncExternalStore(
    (cb) => subscribe(cb),
    () => cache.liked.includes(practiceId),
    () => cache.liked.includes(practiceId),
  );
}

/** Subscribe to a UI-hint flag. */
export function useHintSeen(hintKey: string): boolean {
  return useSyncExternalStore(
    (cb) => subscribe(cb),
    () => cache.uiHints[hintKey] === true,
    () => cache.uiHints[hintKey] === true,
  );
}

/** True once the cache has been seeded from a profile at least
 *  once in this session. Use to gate UI affordances that derive
 *  meaning from "have they seen this before" — e.g. one-time
 *  hints that should NOT pop on cold mount before the cache has
 *  loaded the actual server truth.
 *
 *  Reseeded back to false by `clearCache()` (sign-out), so the
 *  next user's session starts fresh. */
export function useCacheSeeded(): boolean {
  return useSyncExternalStore(
    (cb) => subscribe(cb),
    () => cache.profileId !== null,
    () => cache.profileId !== null,
  );
}

// ─── Coalesced PATCH plumbing ───────────────────────────────────────
//
// Each of the four columns has its own debounce slot. When a mutator
// fires, we update the cache, then schedule a flush after a short
// debounce (300ms). Within that window, additional mutations stack
// onto the same flush, so a user spamming the heart 5x in 200ms
// produces ONE PATCH carrying the final state.

type FieldKey = 'practice_liked' | 'practice_stats' | 'practice_last_used_at' | 'practice_ui_hints';
const DEBOUNCE_MS = 300;
/** Retry attempts on transient PATCH failure (5xx, network throw,
 *  abort other than our own). Exponential backoff between attempts. */
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;

const debounceTimers: Partial<Record<FieldKey, ReturnType<typeof setTimeout>>> = {};
const inflightControllers: Partial<Record<FieldKey, AbortController>> = {};
/** Resolves when the field's currently-scheduled flush actually
 *  completes (success OR final retry failure). Re-created on every
 *  scheduleFlush, awaited by flushPending. */
const pendingPromises: Partial<Record<FieldKey, Promise<void>>> = {};
const pendingResolvers: Partial<Record<FieldKey, () => void>> = {};

/** Schedule a debounced flush AND abort any currently inflight PATCH
 *  for this field. Aborting in the mutator path (not just here) ensures
 *  a stale PATCH carrying an out-of-date snapshot can't win the race
 *  against the fresh state the user just produced. */
function scheduleFlush(field: FieldKey): void {
  /* Abort any inflight PATCH — its body is now stale. */
  inflightControllers[field]?.abort();

  /* Track this scheduled-but-not-yet-fired flush as "pending" so
   * flushPending() can await it. If a previous timer was scheduled
   * but hasn't fired, we replace it; the resolver from the previous
   * round will be called when the eventual flush completes. */
  if (!pendingPromises[field]) {
    pendingPromises[field] = new Promise<void>((resolve) => {
      pendingResolvers[field] = resolve;
    });
  }

  if (debounceTimers[field]) clearTimeout(debounceTimers[field]);
  debounceTimers[field] = setTimeout(() => { void flushField(field); }, DEBOUNCE_MS);
}

async function flushField(field: FieldKey): Promise<void> {
  /* Pull and clear the pending-promise resolver up front so a fresh
   * mutation arriving DURING the network call gets its own promise
   * (a new scheduleFlush from below). */
  const resolver = pendingResolvers[field];
  delete pendingPromises[field];
  delete pendingResolvers[field];

  const profileId = cache.profileId;
  if (!profileId) {
    console.warn('[practiceProfileSync] skip flush · no profileId in cache');
    resolver?.();
    return;
  }
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('[practiceProfileSync] skip flush · no accessToken');
    resolver?.();
    return;
  }

  /* Cancel any other inflight flush for this field (defensive — the
   * mutator path already aborted, but a manual flushPending could
   * race). Then claim the slot. */
  inflightControllers[field]?.abort();
  const controller = new AbortController();
  inflightControllers[field] = controller;

  const buildBody = (): UpdateProfileRequest => {
    /* Snapshot the cache HERE (not before retries) so each retry
     * carries the latest state, not stale state from attempt 1. */
    const body: UpdateProfileRequest = {};
    if (field === 'practice_liked')             body.practice_liked = [...cache.liked];
    else if (field === 'practice_stats')        body.practice_stats = { ...cache.stats };
    else if (field === 'practice_last_used_at') body.practice_last_used_at = { ...cache.lastUsedAt };
    else if (field === 'practice_ui_hints')     body.practice_ui_hints = { ...cache.uiHints };
    return body;
  };

  /* Retry-with-backoff for transient failures. We do NOT retry on
   * our own aborts (a fresher PATCH is on its way; let it win). */
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    if (controller.signal.aborted) {
      console.log('[practiceProfileSync] PATCH ' + field + ' aborted before attempt ' + attempt);
      break;
    }
    console.log('[practiceProfileSync] PATCH ' + field + ' attempt=' + attempt);
    try {
      const { error } = await authPatch(
        ENDPOINTS.PROFILES_UPDATE(profileId),
        buildBody(),
        accessToken,
      );
      if (controller.signal.aborted) break;
      if (!error) {
        /* Success. */
        if (inflightControllers[field] === controller) {
          delete inflightControllers[field];
        }
        resolver?.();
        return;
      }
      lastError = error.message;
      console.warn('[practiceProfileSync] PATCH ' + field + ' attempt ' + attempt + ' failed: ' + lastError);
    } catch (err: any) {
      if (controller.signal.aborted) break;
      lastError = err?.message ?? String(err);
      console.warn('[practiceProfileSync] PATCH ' + field + ' attempt ' + attempt + ' threw: ' + lastError);
    }
    if (attempt < RETRY_ATTEMPTS) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  /* All retries exhausted (or aborted). Don't roll back the cache —
   * the next refreshProfile() will reconcile from server truth. The
   * trade-off: the user's optimistic UI stays intact for now, and
   * we accept a sync-on-next-refresh window. Bump the telemetry
   * counter so a debug screen / failure banner / future Sentry hook
   * can observe without parsing console logs. */
  if (!controller.signal.aborted && lastError) {
    console.warn('[practiceProfileSync] PATCH ' + field + ' GAVE UP after ' + RETRY_ATTEMPTS + ' attempts: ' + lastError);
    recordRetryExhaustion(field, lastError);
  }
  if (inflightControllers[field] === controller) {
    delete inflightControllers[field];
  }
  resolver?.();
}

/** Awaits all currently-scheduled or in-flight PATCHes. Use this
 *  before navigating away from a screen where the user has just
 *  toggled state and durability matters (e.g. the heart on a card,
 *  if the user immediately closes the app). Returns when every
 *  field's queue is empty.
 *
 *  Resolves successfully even if the underlying PATCH ultimately
 *  fails — retry-with-backoff has run, and persistence beyond that
 *  needs the next refreshProfile() to reconcile. */
export async function flushPending(): Promise<void> {
  /* Fire any debounced timers immediately — the user is asking us
   * to commit now, don't wait the rest of the debounce window. */
  for (const field of Object.keys(debounceTimers) as FieldKey[]) {
    const t = debounceTimers[field];
    if (t) {
      clearTimeout(t);
      delete debounceTimers[field];
      void flushField(field);
    }
  }
  /* Now wait for whatever is in flight. */
  const promises = Object.values(pendingPromises).filter(Boolean) as Promise<void>[];
  if (promises.length === 0) return;
  await Promise.all(promises);
}

// ─── Mutators (return synchronously; PATCH fires async) ─────────────

/** Set or unset the liked state for a practice. Returns the new state.
 *  Idempotent — calling twice with the same value is a no-op. */
export function setLiked(practiceId: string, liked: boolean): boolean {
  const has = cache.liked.includes(practiceId);
  if (liked === has) return liked;
  cache.liked = liked
    ? [practiceId, ...cache.liked]
    : cache.liked.filter((x) => x !== practiceId);
  console.log('[practiceProfileSync] setLiked ' + practiceId + '=' + liked);
  emit();
  scheduleFlush('practice_liked');
  return liked;
}

/** Toggle and return the new state. */
export function toggleLiked(practiceId: string): boolean {
  /* Read once into a local — even though JS is single-threaded today,
   * a future refactor that adds an `await` between read and call
   * would otherwise risk reading the cache in two different states. */
  const wasLiked = cache.liked.includes(practiceId);
  return setLiked(practiceId, !wasLiked);
}

/** Record a session against a practice. Increments `totalSessions`
 *  by 1 and merges any caller-supplied counters into the practice's
 *  stats slot. Use for box-breath cycles + secs, brain-dump thought
 *  count, etc. The merge is shallow — caller decides the field
 *  shape per practice id. */
export function recordSession(
  practiceId: string,
  patch: PracticeCounters = {},
): void {
  const prev = cache.stats[practiceId] ?? {};
  const totalSessions = (typeof prev.totalSessions === 'number' ? prev.totalSessions : 0) + 1;
  cache.stats = {
    ...cache.stats,
    [practiceId]: { ...prev, ...patch, totalSessions },
  };
  console.log('[practiceProfileSync] recordSession ' + practiceId + ' · keys=' + Object.keys(patch).join(','));
  emit();
  scheduleFlush('practice_stats');
}

/** Increment a numeric counter on a practice's stats slot. Pass a
 *  positive integer; non-numeric prior values are treated as 0. Use
 *  for brain-dump thought count, drafts shared count, etc. */
export function incrementStat(
  practiceId: string,
  key: keyof PracticeCounters | string,
  by: number = 1,
): void {
  const prev = cache.stats[practiceId] ?? {};
  const prevVal = typeof prev[key] === 'number' ? (prev[key] as number) : 0;
  cache.stats = {
    ...cache.stats,
    [practiceId]: { ...prev, [key]: prevVal + by },
  };
  console.log('[practiceProfileSync] incrementStat ' + practiceId + '.' + String(key) + '+=' + by);
  emit();
  scheduleFlush('practice_stats');
}

/** Stamp `practice_last_used_at[practiceId]` with the current time
 *  (ISO). Drives the practice library's recently-used sort. */
export function markUsed(practiceId: string, at: Date = new Date()): void {
  const iso = at.toISOString();
  if (cache.lastUsedAt[practiceId] === iso) return;
  cache.lastUsedAt = { ...cache.lastUsedAt, [practiceId]: iso };
  console.log('[practiceProfileSync] markUsed ' + practiceId);
  emit();
  scheduleFlush('practice_last_used_at');
}

/** Set / clear a one-time UI hint flag. Server-side replacement for
 *  the AsyncStorage-backed hasSeenSaveHint / markSaveHintSeen pair. */
export function setHintSeen(hintKey: string, seen: boolean = true): void {
  if (cache.uiHints[hintKey] === seen) return;
  cache.uiHints = { ...cache.uiHints, [hintKey]: seen };
  console.log('[practiceProfileSync] setHintSeen ' + hintKey + '=' + seen);
  emit();
  scheduleFlush('practice_ui_hints');
}

// ─── Internals ──────────────────────────────────────────────────────

/** Set-equality compare — order-insensitive. We use this for the
 *  liked-practices array because the server may return ids in
 *  alphabetical / insertion / arbitrary order, and we don't want
 *  every reseed to trigger a spurious emit just because the order
 *  changed. */
function sameArray(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const item of b) if (!setA.has(item)) return false;
  return true;
}

function sameJson(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  /* Cheap structural compare — fine for the small shapes we store
   * here (≤ a few dozen keys). Don't use for arbitrary objects. */
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
