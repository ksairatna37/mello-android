/**
 * Tiny external store for fullscreen mode.
 * Used by VoiceAgentScreen to tell _layout.tsx to hide the tab bar.
 * Compatible with React.useSyncExternalStore.
 *
 * Animation handled entirely by _layout.tsx using reanimated
 * (GPU-only transform/opacity). This store is pure state.
 */

let isFullscreen = false;
const listeners = new Set<() => void>();

export const fullscreenStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot: () => isFullscreen,
  set: (value: boolean) => {
    if (isFullscreen === value) return;
    isFullscreen = value;
    listeners.forEach((l) => l());
  },
};
