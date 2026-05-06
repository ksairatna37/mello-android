/**
 * Liked-practices service — thin facade over `practiceProfileSync`.
 *
 * Preserves the legacy Promise-returning API so existing call sites
 * (SavePracticeButton, BoxBreathSummary, the practice library) don't
 * have to change. Internally everything reads/writes the in-memory
 * cache in `practiceProfileSync.ts`, which mirrors the new
 * `practice_liked` and `practice_ui_hints` columns on `profiles`.
 *
 * No AsyncStorage. All state lives server-side; the in-memory cache
 * is reseeded on every `refreshProfile()` call from AuthContext.
 *
 * Design note on the lingering async signatures:
 *   The reads are now actually synchronous (they hit a module-level
 *   cache) but we keep `Promise<T>` returns for source-compat. New
 *   call sites should prefer the sync helpers exported from
 *   `practiceProfileSync` directly:
 *     - `isLikedSync(id)` for an instant-render heart fill
 *     - `subscribe(fn)` to react to cross-device profile updates
 */

import {
  getLikedSync,
  isLikedSync,
  setLiked as setLikedSync,
  toggleLiked as toggleLikedSync,
  getHintSync,
  setHintSeen,
  flushPending as flushPendingSync,
} from './practiceProfileSync';

/** Flush any debounced / inflight PATCHes immediately. Use before
 *  navigating away from a screen where durability matters more than
 *  the optimistic-UI debounce window (e.g. closing the app right
 *  after a heart-tap). Resolves even if the underlying network call
 *  ultimately failed; the next refreshProfile() reconciles. */
export async function flushPendingSaves(): Promise<void> {
  await flushPendingSync();
}

/* ─── Liked practices ─────────────────────────────────────────────── */

export async function getLikedPractices(): Promise<string[]> {
  return [...getLikedSync()];
}

export async function isPracticeLiked(id: string): Promise<boolean> {
  return isLikedSync(id);
}

/** Idempotent — calling twice with the same value is a no-op. */
export async function setPracticeLiked(id: string, liked: boolean): Promise<void> {
  setLikedSync(id, liked);
}

/** Flip current state. Returns the new liked value. */
export async function togglePracticeLike(id: string): Promise<boolean> {
  return toggleLikedSync(id);
}

/* ─── One-time hint flags ─────────────────────────────────────────── */

export async function hasSeenSaveHint(key: string): Promise<boolean> {
  return getHintSync(key);
}

export async function markSaveHintSeen(key: string): Promise<void> {
  setHintSeen(key, true);
}
