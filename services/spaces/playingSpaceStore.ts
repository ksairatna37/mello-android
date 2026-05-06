/**
 * Globally-known "currently playing Sound Space" — process-wide store.
 *
 * Set by `SelfMindSoundSpaceSitting` whenever the user's active room
 * is playing audio; cleared when paused, when the screen unmounts, or
 * when audio fails. The home screen subscribes via
 * `useSyncExternalStore` to render a "now playing" indicator beside
 * the bell — one tap opens the active room.
 *
 * Tiny external-store pattern matching `utils/fullscreenStore.ts`.
 * Pure state; no animation, no side effects.
 */

let currentSpaceId: string | null = null;
const listeners = new Set<() => void>();

export const playingSpaceStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot: (): string | null => currentSpaceId,
  set: (id: string | null) => {
    if (currentSpaceId === id) return;
    currentSpaceId = id;
    listeners.forEach((l) => l());
  },
  clear: () => {
    if (currentSpaceId === null) return;
    currentSpaceId = null;
    listeners.forEach((l) => l());
  },
};
