/**
 * Sidebar store — open/close state + session context.
 *
 * Pattern mirrors fullscreenStore: external store compatible with
 * React.useSyncExternalStore, zero prop-drilling.
 *
 * Context (currentSessionId / currentTitle / userEmail) is set by
 * ChatScreen so the sidebar always reflects the active session. Any
 * other screen that opens the sidebar just gets empty context — the
 * sidebar still works, the "active" highlight simply doesn't apply.
 *
 * getSnapshot returns the same object reference unless something actually
 * changed, so useSyncExternalStore never causes spurious re-renders.
 */

type SidebarState = {
  readonly isOpen: boolean;
  readonly currentSessionId: string;
  readonly currentTitle: string;
  readonly userEmail: string;
};

const INITIAL: SidebarState = {
  isOpen: false,
  currentSessionId: '',
  currentTitle: '',
  userEmail: '',
};

let state = INITIAL;
const listeners = new Set<() => void>();

function update(partial: Partial<SidebarState>) {
  const next: SidebarState = {
    isOpen: partial.isOpen ?? state.isOpen,
    currentSessionId: partial.currentSessionId ?? state.currentSessionId,
    currentTitle: partial.currentTitle ?? state.currentTitle,
    userEmail: partial.userEmail ?? state.userEmail,
  };
  // Identity bail-out — no change, no notification
  if (
    next.isOpen === state.isOpen &&
    next.currentSessionId === state.currentSessionId &&
    next.currentTitle === state.currentTitle &&
    next.userEmail === state.userEmail
  ) return;
  state = next;
  listeners.forEach(l => l());
}

export const sidebarStore = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  /** Returns same reference if nothing changed — safe for useSyncExternalStore */
  getSnapshot: () => state,

  open: () => update({ isOpen: true }),
  close: () => update({ isOpen: false }),

  /**
   * Called by ChatScreen on every session-context change so the sidebar
   * shows the correct highlighted session and user display name.
   */
  setContext: (ctx: Pick<SidebarState, 'currentSessionId' | 'currentTitle' | 'userEmail'>) =>
    update(ctx),
};
