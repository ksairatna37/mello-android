/**
 * chatNavStore — pending navigation request from the sidebar.
 *
 * Flow (sidebar opened from any tab):
 *   _layout.tsx sidebar action → chatNavStore.push(req) → router.navigate('/chat')
 *   ChatScreen  → useSyncExternalStore → useEffect → execute req → chatNavStore.clear()
 *
 * Because the store outlives component mounts, the request is reliably consumed
 * even when ChatScreen wasn't mounted at push time — useSyncExternalStore reads
 * getSnapshot() on mount and schedules a render if the value is non-null.
 */

import type { ChatSession } from '@/services/chat/sessionHistory';

export type ChatNavRequest =
  | { type: 'new-chat' }
  | { type: 'select-session'; session: ChatSession }
  | null;

let pending: ChatNavRequest = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

export const chatNavStore = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  getSnapshot: (): ChatNavRequest => pending,

  push: (req: Exclude<ChatNavRequest, null>) => {
    pending = req;
    notify();
  },
  /** Idempotent — safe to call multiple times (React StrictMode double-fire). */
  clear: () => {
    if (pending !== null) {
      pending = null;
      notify();
    }
  },
};
