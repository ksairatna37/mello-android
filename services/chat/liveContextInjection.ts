/**
 * liveContextInjection — runtime microservice for "live" context
 * injection into Bedrock (or any LLM) calls anywhere in the app.
 *
 * Why this exists:
 *   Some AI replies need to know about things that happened OUTSIDE
 *   the chat transcript itself — e.g. the user just finished a box
 *   breath, opened a helpline, set a calendar reminder, completed an
 *   onboarding question, took a screenshot. Threading these through
 *   the prompt manually from every call site is brittle. This module
 *   gives the rest of the app a one-line emit API and gives the LLM
 *   call site a one-line consume-and-inject API.
 *
 * Two-layer model:
 *   1. STORE       — append events and set variables, scoped by name.
 *                    Any feature can write; one consumer drains.
 *   2. FORMATTER   — pure function turning a scope snapshot into a
 *                    natural-language system-prompt addendum. Each
 *                    scope can register its own formatter once at
 *                    module load. Unknown scopes fall back to a
 *                    default JSON dump so nothing is silently lost.
 *
 * How to use it for a NEW feature:
 *   1. Pick a scope name. Convention: kebab-case, app-area-prefixed
 *      (e.g. `crisis-flow`, `journal-streak`, `voice-permissions`).
 *   2. At module load, call `registerFormatter(scope, formatterFn)`
 *      to teach this service how to render your scope as a system
 *      note. Formatter receives `{ events: string[], vars: Record<...> }`
 *      and returns a string (empty = nothing to inject).
 *   3. From anywhere, call `recordEvent(scope, eventName)` or
 *      `setVariable(scope, key, value)` as the user acts.
 *   4. From the bedrock call site, pass `injectScopes: [scope]` to
 *      `sendToBedrock` (or use `buildAddendum` directly). The default
 *      consume-mode wipes the scope after building the addendum so
 *      the same context never injects twice.
 *
 * Lifecycle:
 *   In-memory only. Clears on app restart. Auth-state changes (sign
 *   out, switch user) should call `clearAllScopes()` so prior state
 *   doesn't leak. Single-user device assumption is fine for now.
 *
 * Threading:
 *   JS is single-threaded so no locks. All emits/consumes are sync.
 */

// ─── Types ─────────────────────────────────────────────────────────

export type Primitive = string | number | boolean | null;

export interface ScopeSnapshot {
  /** Append-only event log for this scope, in emit order. */
  events: string[];
  /** Key/value bag for this scope. Last write wins. */
  vars: Record<string, Primitive>;
}

/** Pure function: scope snapshot → system-prompt addendum. Return an
 *  empty string when there's nothing meaningful to inject. */
export type ScopeFormatter = (snapshot: ScopeSnapshot) => string;

export interface BuildAddendumOptions {
  /** Scopes to include, in the order they should appear. */
  scopes: string[];
  /** If true (default), each scope is drained after its addendum is
   *  built — so a follow-up Bedrock call won't re-inject the same
   *  events. Set to false to keep the scope intact (e.g. for a peek
   *  / debug call). */
  consume?: boolean;
}

// ─── Store ─────────────────────────────────────────────────────────

const scopes = new Map<string, ScopeSnapshot>();
const formatters = new Map<string, ScopeFormatter>();

function ensureScope(scope: string): ScopeSnapshot {
  let s = scopes.get(scope);
  if (!s) {
    s = { events: [], vars: {} };
    scopes.set(scope, s);
  }
  return s;
}

/** Append an event to a scope's log. Empty events are ignored. */
export function recordEvent(scope: string, event: string): void {
  if (!event) return;
  const s = ensureScope(scope);
  s.events.push(event);
  console.log('[liveContext:' + scope + '] + ' + event + ' (events=' + s.events.length + ')');
}

/** Set a variable on a scope. Pass `null` to explicitly clear a key. */
export function setVariable(scope: string, key: string, value: Primitive): void {
  if (!key) return;
  const s = ensureScope(scope);
  if (value === null) delete s.vars[key];
  else s.vars[key] = value;
  console.log('[liveContext:' + scope + '] var ' + key + '=' + String(value));
}

/** Read a variable from a scope. Returns `undefined` if unset. */
export function getVariable(scope: string, key: string): Primitive | undefined {
  return scopes.get(scope)?.vars[key];
}

/** Read the full snapshot for a scope (returns an empty snapshot if
 *  the scope has never been written to — convenient for formatters). */
export function peekScope(scope: string): ScopeSnapshot {
  const s = scopes.get(scope);
  if (!s) return { events: [], vars: {} };
  /* Return a defensive copy so callers can't mutate the live store. */
  return { events: [...s.events], vars: { ...s.vars } };
}

/** Drain a scope: returns its current snapshot and resets the slot. */
export function consumeScope(scope: string): ScopeSnapshot {
  const snap = peekScope(scope);
  scopes.delete(scope);
  if (snap.events.length || Object.keys(snap.vars).length) {
    console.log('[liveContext:' + scope + '] consumed (events=' + snap.events.length + ' vars=' + Object.keys(snap.vars).length + ')');
  }
  return snap;
}

/** Wipe a single scope without consuming. */
export function clearScope(scope: string): void {
  if (scopes.delete(scope)) console.log('[liveContext:' + scope + '] cleared');
}

/** Wipe everything — call on sign-out, user switch, or major reset. */
export function clearAllScopes(): void {
  if (scopes.size > 0) console.log('[liveContext] clearAll · ' + scopes.size + ' scope(s)');
  scopes.clear();
}

// ─── Formatters ────────────────────────────────────────────────────

/** Register (or replace) the formatter for a scope. Idempotent. */
export function registerFormatter(scope: string, fn: ScopeFormatter): void {
  formatters.set(scope, fn);
}

/** Default formatter for scopes that haven't registered one — dumps
 *  the snapshot as a small JSON-ish summary so nothing is lost. */
function defaultFormatter(scope: string, snap: ScopeSnapshot): string {
  if (snap.events.length === 0 && Object.keys(snap.vars).length === 0) return '';
  const lines: string[] = [`Live context (${scope}):`];
  if (snap.events.length) {
    lines.push('events:');
    for (const e of snap.events) lines.push('  - ' + e);
  }
  if (Object.keys(snap.vars).length) {
    lines.push('variables:');
    for (const [k, v] of Object.entries(snap.vars)) lines.push('  - ' + k + ': ' + String(v));
  }
  return lines.join('\n');
}

/**
 * Build a single system-prompt addendum string from the requested
 * scopes. Returns `''` when nothing to inject. Consumes by default.
 *
 * Use this when you want the addendum string yourself (e.g. to log
 * it, transform it, or attach to a non-Bedrock service). When using
 * Bedrock, prefer `sendToBedrock(messages, { injectScopes: [...] })`.
 */
export function buildAddendum(opts: BuildAddendumOptions): string {
  const consume = opts.consume !== false;
  const chunks: string[] = [];
  for (const scope of opts.scopes) {
    const snap = consume ? consumeScope(scope) : peekScope(scope);
    if (snap.events.length === 0 && Object.keys(snap.vars).length === 0) continue;
    const formatter = formatters.get(scope);
    const text = formatter ? formatter(snap) : defaultFormatter(scope, snap);
    if (text.trim().length > 0) chunks.push(text.trim());
  }
  return chunks.join('\n\n');
}

// ─── Crisis-flow scope (registered at module load) ─────────────────
//
// First concrete consumer of this microservice. The crisis flow
// records events as the user navigates resources / breath / drafts;
// ChatScreen.releasePendingAI calls the Bedrock send with
// `injectScopes: [SCOPE_CRISIS_FLOW]` so Mello's deferred reply is
// aware of what the user did instead of replying to the original
// heavy message in a vacuum.

export const SCOPE_CRISIS_FLOW = 'crisis-flow';

/** Convenience emitter so call sites don't have to import the scope
 *  constant + recordEvent separately. */
export function recordCrisisFlowEvent(event: string): void {
  recordEvent(SCOPE_CRISIS_FLOW, event);
}

/* Concrete follow-up events — anything beyond just opening the
 * resources page. Used to detect the "saw resources but didn't act"
 * shape, which calls for a different (more held, less congratulatory)
 * AI tone than the "did the breath / texted a friend" shape. */
const CRISIS_CONCRETE_FOLLOWUPS: ReadonlySet<string> = new Set([
  'opened-icall-helpline',
  'opened-kiran-helpline',
  'opened-tell-someone',
  'sent-tell-someone-message',
  'started-box-breath',
]);

registerFormatter(SCOPE_CRISIS_FLOW, ({ events }) => {
  if (events.length === 0) return '';

  const hasViewed = events.includes('viewed-resources');
  const hasConcrete = events.some((e) =>
    CRISIS_CONCRETE_FOLLOWUPS.has(e) || e.startsWith('completed-box-breath'),
  );

  /* SHAPE A — User opened the resources page and walked away without
   * tapping anything. They paused with us; that's its own quiet act.
   * Don't congratulate (nothing was "completed"), don't pry, don't
   * list anything they could have done. Hold the space. */
  if (hasViewed && !hasConcrete) {
    return [
      'CRISIS-FLOW CONTEXT — IMPORTANT, READ CAREFULLY:',
      'Your previous reply was held when the user said something heavy. They opened the crisis resources page, sat with it for a moment, and came back to the chat without tapping a helpline, drafting a message, or starting a breath exercise.',
      'This is delicate. They paused; that itself is something. They may not be ready to act, or they may simply want to keep talking. Your job in this single reply:',
      '- Acknowledge softly that they came back. Do NOT congratulate them — nothing concrete was completed.',
      '- Do NOT mention the resources, the helplines, or the things they didn\'t do. No "if you ever need…", no "those numbers are still there." That\'s pressure dressed as care.',
      '- Do NOT ask "are you safe?", "are you okay?", or any diagnostic question — the system already paused for that.',
      '- Stay with the feeling that started this, gently. Make space for them to keep going OR to just be quiet. Lowercase voice. No exclamation marks.',
      '- Keep it 1–2 sentences. The reply should feel like sitting next to someone, not checking on them.',
    ].join('\n');
  }

  /* SHAPE B — User took at least one concrete follow-up action.
   * Acknowledge the specific thing, warmly but briefly. */
  const actions: string[] = [];
  for (const e of events) {
    if (e === 'viewed-resources') actions.push('opened the crisis resources page');
    else if (e === 'opened-icall-helpline') actions.push('tapped the iCall helpline link');
    else if (e === 'opened-kiran-helpline') actions.push('tapped the KIRAN 24/7 helpline link');
    else if (e === 'opened-tell-someone') actions.push('opened the "tell someone you trust" drafts');
    else if (e === 'sent-tell-someone-message') actions.push('sent a vulnerable message to a trusted person');
    else if (e === 'started-box-breath') actions.push('started a box-breathing exercise');
    else if (e.startsWith('completed-box-breath')) {
      const m = e.match(/cycles=(\d+).*secs=(\d+)/);
      if (m) {
        const cycles = parseInt(m[1], 10);
        const secs = parseInt(m[2], 10);
        actions.push(`finished ${cycles} cycle${cycles === 1 ? '' : 's'} of box breathing (~${secs}s)`);
      } else {
        actions.push('finished box breathing');
      }
    } else {
      /* Unknown event — pass through verbatim so we don't silently
       * lose context. The crisis flow can grow new event types
       * without requiring an immediate update here. */
      actions.push(e);
    }
  }

  return [
    'CRISIS-FLOW CONTEXT — IMPORTANT, READ CAREFULLY:',
    'Your previous reply was held when the user said something heavy. While paused, the user did the following (in order):',
    ...actions.map((a) => '- ' + a),
    'They are now back in the chat. Your job in this single reply:',
    '- Gently acknowledge what they did. Pick ONE specific action (the most concrete or recent) and name it warmly. Do NOT list everything.',
    '- Thank them softly for staying / coming back. Lowercase voice. No exclamation marks.',
    '- Do NOT re-list helplines or repeat the crisis resources copy — they already saw them.',
    '- Do NOT ask diagnostic questions ("are you safe?", "are you okay now?") — the system already paused for that.',
    '- Keep it 1–2 sentences. End with a soft, low-pressure invitation to keep going at their pace.',
  ].join('\n');
});
