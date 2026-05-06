/**
 * Mood service — row-shape wrapper around `/rest/v1/mood_checkins`.
 *
 * BACKEND CONTRACT (post-migration, 2026-05-05):
 *   POST /rest/v1/mood_checkins
 *     body: { user_id, date, mood?, battery?, note?, createdAt? }
 *     Backend upserts on (user_id, date) — same-day re-logs overwrite.
 *
 *   GET /rest/v1/mood_checkins?user_id=eq.<uuid>
 *     Returns row array, server columns in snake_case.
 *
 * BEFORE the migration, this service did read-modify-write of a JSON
 * doc on `user_onboarding.mood`. That blob shape is gone; backend
 * routes data to the dedicated `public.mood_checkins` table now,
 * with a UNIQUE (user_id, date) constraint enforcing the "one
 * canonical reading per day" rule the client used to enforce
 * client-side via the dedupe-by-date filter.
 *
 * Client API stays stable for consumers — `fetchCheckins` /
 * `addCheckin` / `lastNDays` keep the same signatures and return
 * shapes. The only difference is `addCheckin` no longer round-trips
 * the entire blob: it POSTs a single row.
 *
 * Legacy-data migration is read-only: rows that came from the old
 * blob (or were originally written under the heavy/steady/wired/...
 * vocabulary) get mapped to the current 5-state vocabulary via
 * `LEGACY_MOOD_MAP` on the way in. No write-side migration needed —
 * the backend ran a backfill from `user_onboarding.mood` into the
 * new table.
 */

import { authGet, authPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getAccessToken, getSession } from '@/services/auth';
import { MOOD_KEYS, type MoodId } from '@/components/mood/MoodDot';

/* ─── Types ───────────────────────────────────────────────────────── */

export interface MoodCheckin {
  /** ISO date `YYYY-MM-DD` for the day this checkin represents.
   *  Local-calendar day, NOT UTC — the client uses
   *  `getFullYear/Month/Date` so "today" matches the user's perceived
   *  day regardless of their timezone offset. */
  date: string;
  /** Self-reported energy level 0..100 — same scale as the onboarding
   *  battery question, so we can chain them on the Progress chart.
   *  Independent of `mood` (categorical); both signals can co-exist. */
  battery?: number;
  /** Strict 5-state mood union — see `MoodId` in components/mood/MoodDot.tsx.
   *  Legacy rows carrying old-vocabulary or chip-shape values get
   *  remapped on read via `LEGACY_MOOD_MAP`. */
  mood?: MoodId;
  /** Optional one-liner reflection. */
  note?: string;
  /** ISO 8601 timestamp of when the checkin was recorded. Server
   *  populates `created_at` automatically; client also sends a
   *  client-stamped `createdAt` so optimistic UIs can show the
   *  exact-moment timestamp without round-tripping. */
  createdAt?: string;
}

/** Server row shape — what GET returns. Snake_case columns. Mapped
 *  to `MoodCheckin` via `rowToCheckin`. */
interface MoodCheckinRow {
  id: string;
  user_id: string;
  date: string;
  mood?: string | null;
  battery?: number | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const optimisticCheckins = new Map<string, MoodCheckin>();

/* ─── Vocabulary migration (read-side only) ──────────────────────── */

/** Set lookup: MoodId values that pass through unchanged. */
const MOOD_KEY_SET: ReadonlySet<string> = new Set(MOOD_KEYS);

/** Maps legacy 7-state vocabulary (heavy / steady / wired / soft /
 *  tired / bright / prickly) to the current 5-state vocabulary. The
 *  backend's blob-era backfill may have preserved these strings; we
 *  remap on read so the UI never sees garbage. */
const LEGACY_MOOD_MAP: Readonly<Record<string, MoodId>> = {
  heavy:   'notGood',
  prickly: 'notGood',
  wired:   'meh',
  steady:  'ok',
  tired:   'ok',
  soft:    'good',
  bright:  'amazing',
};

function normalizeMoodKey(value: unknown): MoodId | undefined {
  if (typeof value !== 'string') return undefined;
  if (MOOD_KEY_SET.has(value)) return value as MoodId;
  return LEGACY_MOOD_MAP[value];
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

async function requireAuth(): Promise<{
  token: string;
  userId: string;
} | { error: string }> {
  const token = await getAccessToken();
  const session = await getSession();
  if (!token || !session?.userId) {
    return { error: 'not authenticated' };
  }
  return { token, userId: session.userId };
}

/** Server row → client `MoodCheckin`. Drops invalid rows (missing
 *  date, or a `mood` string that doesn't map to a known MoodId AND
 *  no `battery` reading either — empty rows are useless to the UI). */
function rowToCheckin(r: MoodCheckinRow | null | undefined): MoodCheckin | null {
  if (!r || typeof r.date !== 'string') return null;
  const mood = normalizeMoodKey(r.mood);
  const battery = typeof r.battery === 'number' ? r.battery : undefined;
  const note = typeof r.note === 'string' && r.note.length > 0 ? r.note : undefined;
  if (mood === undefined && battery === undefined) return null;
  return {
    date: r.date,
    mood,
    battery,
    note,
    createdAt: r.created_at,
  };
}

/** Local-day key in `YYYY-MM-DD` form, NOT UTC. UTC drift is a real
 *  bug for any user not on UTC (e.g. PST evening rolls into next-day
 *  UTC), and "today" for a mental-health surface must mean the user's
 *  perceived day. Both `addCheckin` and `lastNDays` use this so reads
 *  and writes agree on the calendar boundary. */
function localDayKey(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function mergeOptimisticCheckins(checkins: MoodCheckin[]): MoodCheckin[] {
  if (optimisticCheckins.size === 0) return checkins;
  const byDate = new Map<string, MoodCheckin>();
  for (const c of checkins) byDate.set(c.date, c);
  for (const [date, optimistic] of optimisticCheckins) {
    const existing = byDate.get(date);
    if (!existing || (optimistic.createdAt ?? '') >= (existing.createdAt ?? '')) {
      byDate.set(date, optimistic);
    }
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/* ─── Public API ──────────────────────────────────────────────────── */

/** GET all checkins for the current user, newest first. Drops rows
 *  the backend returns with malformed or empty data. */
export async function fetchCheckins(): Promise<Result<MoodCheckin[]>> {
  const auth = await requireAuth();
  if ('error' in auth) return { ok: false, error: auth.error };

  /* `&order=date.desc` lets the server do the sort — works under
   * PostgREST and saves a client-side pass. */
  const url = `${ENDPOINTS.MOOD_CHECKINS}?user_id=eq.${auth.userId}&order=date.desc`;
  const { data, error } = await authGet<MoodCheckinRow[] | null>(url, auth.token);
  if (error) {
    /* 404 on this endpoint = "no rows yet" — treat as empty success
     * so a fresh user's home screen doesn't show an error toast. */
    if ((error as { status?: number }).status === 404) {
      return { ok: true, data: mergeOptimisticCheckins([]) };
    }
    return { ok: false, error: error.message ?? 'fetch failed' };
  }

  if (!Array.isArray(data)) return { ok: true, data: mergeOptimisticCheckins([]) };
  const checkins: MoodCheckin[] = [];
  for (const row of data) {
    const c = rowToCheckin(row);
    if (c) checkins.push(c);
  }
  /* Defensive re-sort even though we asked the server to order — a
   * mid-session local optimistic insert (if added later) might land
   * out of order. */
  checkins.sort((a, b) => b.date.localeCompare(a.date));
  return { ok: true, data: mergeOptimisticCheckins(checkins) };
}

/** POST a checkin. Backend upserts on (user_id, date), so a same-day
 *  re-log overwrites the prior reading without the client having to
 *  fetch + filter + repost the whole history. Returns the canonical
 *  row the server stored.
 *
 *  Required: at least one of `mood` or `battery`. Empty checkins are
 *  rejected client-side so the backend doesn't have to. */
export async function addCheckin(
  c: Omit<MoodCheckin, 'date' | 'createdAt'> & {
    date?: string;
    createdAt?: string;
  },
): Promise<Result<MoodCheckin>> {
  if (c.mood === undefined && c.battery === undefined) {
    return { ok: false, error: 'mood or battery required' };
  }

  const date = c.date ?? localDayKey();
  const createdAt = c.createdAt ?? new Date().toISOString();
  optimisticCheckins.set(date, {
    date,
    mood: c.mood,
    battery: c.battery,
    note: c.note,
    createdAt,
  });

  const auth = await requireAuth();
  if ('error' in auth) {
    optimisticCheckins.delete(date);
    return { ok: false, error: auth.error };
  }

  const body = {
    user_id: auth.userId,
    date,
    mood: c.mood,
    battery: c.battery,
    note: c.note,
    createdAt,
  };

  console.log('[moodService] addCheckin → date=' + body.date + ' mood=' + (body.mood ?? '—') + ' battery=' + (body.battery ?? '—'));

  const { data, error } = await authPost<MoodCheckinRow, typeof body>(
    ENDPOINTS.MOOD_CHECKINS,
    body,
    auth.token,
  );
  if (error || !data) {
    console.warn('[moodService] addCheckin error:', error?.message);
    optimisticCheckins.delete(date);
    return { ok: false, error: error?.message ?? 'save failed' };
  }

  const checkin = rowToCheckin(data);
  optimisticCheckins.delete(date);
  if (!checkin) {
    /* Server accepted but returned a row we can't parse — fall back
     * to the request body so the optimistic UI stays consistent. */
    return {
      ok: true,
      data: {
        date: body.date,
        mood: body.mood,
        battery: body.battery,
        note: body.note,
        createdAt: body.createdAt,
      },
    };
  }
  return { ok: true, data: checkin };
}

/** Slice the most recent `n` calendar days as an ordered array,
 *  oldest first, with `null` for missing days. Convenient for the
 *  Progress chart and the 14-day grid card.
 *
 *  Pure helper — does NOT hit the network. Pass in the result of
 *  `fetchCheckins` or a parent's cached array. */
export function lastNDays(
  checkins: MoodCheckin[],
  n: number,
): Array<MoodCheckin | null> {
  const map = new Map<string, MoodCheckin>();
  for (const c of checkins) map.set(c.date, c);

  const out: Array<MoodCheckin | null> = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    /* Local-day key — must match the helper used by `addCheckin` so
     * read and write agree on the calendar boundary regardless of
     * the device's UTC offset. */
    const key = localDayKey(d);
    out.push(map.get(key) ?? null);
  }
  return out;
}
