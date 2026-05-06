/**
 * Liked Sound Spaces — local AsyncStorage persistence.
 *
 * Keeps a Set of liked space ids in `@selfmind:likedSpaces`. In-memory
 * cache is hydrated on first read and kept in sync on every write so
 * subscribers can render synchronously after the initial hydration.
 *
 * Server sync is not wired yet (parallel to where practices started —
 * see `services/practice/likedPractices.ts` history). When it lands,
 * swap the AsyncStorage I/O for a profile-column read/write in the
 * same shape; subscribers don't need to change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@selfmind:likedSpaces';

let cache: Set<string> | null = null;
const subscribers = new Set<() => void>();

async function hydrate(): Promise<Set<string>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    cache = new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function notify() {
  for (const fn of subscribers) fn();
}

async function persist() {
  if (!cache) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([...cache]));
  } catch (err) {
    // The next mutation re-writes the full cache, so a transient
    // failure here is self-healing on the next user action. Log so
    // we notice systematic storage problems in dev / Sentry.
    console.warn('[likedSpaces] persist failed', err);
  }
}

/** Resolves the cached set. Caller is free to read-only. */
export async function getLikedSpaces(): Promise<ReadonlySet<string>> {
  return hydrate();
}

/** Sync read. Returns null until hydrate() has resolved at least once. */
export function getLikedSpacesSync(): ReadonlySet<string> | null {
  return cache;
}

export async function isSpaceLiked(id: string): Promise<boolean> {
  const set = await hydrate();
  return set.has(id);
}

/** Idempotent — calling twice with the same value is a no-op. */
export async function setSpaceLiked(id: string, liked: boolean): Promise<void> {
  const set = await hydrate();
  const had = set.has(id);
  if (liked === had) return;
  if (liked) set.add(id); else set.delete(id);
  notify();
  void persist();
}

/** Flip current state. Returns the new liked value. */
export async function toggleSpaceLike(id: string): Promise<boolean> {
  const set = await hydrate();
  const next = !set.has(id);
  if (next) set.add(id); else set.delete(id);
  notify();
  void persist();
  return next;
}

/** Subscribe to liked-set changes. Returns an unsubscribe fn. */
export function subscribeLikedSpaces(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

/** Wipe the in-memory cache AND the on-disk record. Call on sign-out
 *  so user A's hearts don't leak into user B's session. Subscribers
 *  fire so any mounted "Saved" surface re-renders empty immediately. */
export async function clearLikedSpaces(): Promise<void> {
  cache = new Set();
  notify();
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (err) {
    console.warn('[likedSpaces] clear failed', err);
  }
}
