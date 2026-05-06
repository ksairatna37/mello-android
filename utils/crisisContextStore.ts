/**
 * crisisContextStore — small in-memory store for the chat conversation
 * snippet that triggered a crisis. Read by `/tell-someone` so drafts
 * can be informed by what the user was actually working through, not
 * a generic "I'm not okay" template.
 *
 * Pattern mirrors `crisisResumeStore` — module-level state, set by
 * ChatScreen on crisis detection, consumed by tell-someone (read-only
 * — no clear-on-read so re-opens within the same crisis flow keep the
 * same context). Cleared when ChatScreen leaves crisis state.
 *
 * Data is never persisted (in-memory only). When the app process
 * exits, context resets — same as the crisis modal itself. Privacy-
 * preserving: nothing about a heavy moment lingers across launches.
 */

interface ConversationSnippet {
  /** Last few messages, normalised to short strings. */
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
  /** Timestamp the snippet was captured — used for log breadcrumbs. */
  capturedAt: number;
}

let current: ConversationSnippet | null = null;

export const crisisContextStore = {
  /** Capture a snippet (last ~6 messages of the active chat). */
  set: (messages: ConversationSnippet['messages']): void => {
    current = {
      messages: messages.slice(-6),
      capturedAt: Date.now(),
    };
    console.log('[crisisContextStore] set, msgs=' + current.messages.length);
  },
  /** Read without clearing. Returns null if no context captured. */
  peek: (): ConversationSnippet | null => current,
  /** Wipe the store — call when crisis flow ends or chat is closed. */
  clear: (): void => {
    if (current) console.log('[crisisContextStore] cleared');
    current = null;
  },
};
