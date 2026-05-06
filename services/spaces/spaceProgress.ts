/**
 * Per-space audio playback progress — in-memory store.
 *
 * Each Sound Space remembers the active audio file's last playback
 * position (in milliseconds) and the user's most recent playing flag.
 * A user who steps out of Still Water at 01:24 of audio time later
 * resumes from 01:24, not from 00:00. Sibling spaces are independent
 * — opening Storm Shelter after Still Water does NOT inherit Still
 * Water's position.
 *
 * Naming note: the field is called `accumulatedMs` for historical
 * reasons (it once stored elapsed-session-ms). With the audio-driven
 * rewrite, it now stores audio-file-position-ms. Same shape; semantic
 * change. Don't rename without a migration if AsyncStorage persistence
 * is added later.
 *
 * Lifetime: app session. Not persisted to AsyncStorage — a full app
 * relaunch resets all rooms to 00:00. The contemplative surface is
 * meant to feel fresh on cold start; persisting cross-restart would
 * imply a timer the user is "tracking", which conflicts with the
 * "stay as long or as short as you like" voice.
 *
 * Read/write contract:
 *  - `getSpaceProgress(id)` returns the saved state, or a clean default
 *    `{ accumulatedMs: 0, playing: true }` for a never-visited space.
 *  - `setSpaceProgress(id, p)` overwrites the saved state. Idempotent;
 *    callers don't need to diff before writing.
 *  - `clearSpaceProgress(id)` resets a single space (used by replay).
 *  - `clearAllSpaceProgress()` resets every space — called by
 *    `AuthContext.signOut` (and the SIGNED_OUT listener path) so a
 *    second user signing in on the same device doesn't inherit the
 *    first user's clocks.
 */

export interface SpaceProgress {
  accumulatedMs: number;
  playing: boolean;
}

const map = new Map<string, SpaceProgress>();

/* Always returns a fresh object — never the same reference twice. A
 * caller that mutates the returned value can never corrupt the store
 * or another space's state by accident. */
export function getSpaceProgress(id: string): SpaceProgress {
  const stored = map.get(id);
  return stored ? { ...stored } : { accumulatedMs: 0, playing: true };
}

export function setSpaceProgress(id: string, p: SpaceProgress): void {
  map.set(id, p);
}

export function clearSpaceProgress(id: string): void {
  map.delete(id);
}

export function clearAllSpaceProgress(): void {
  map.clear();
}
