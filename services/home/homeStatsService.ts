/**
 * Home stats service — the single source of truth for the Home dashboard.
 *
 * Pulls genuine, user-derived signals:
 *   • battery  — composite wellbeing score from local mood + journal history
 *   • streak   — consecutive days of engagement (mood or journal)
 *   • journaledToday — true if a journal entry exists today (local OR backend)
 *   • lastJournalAgo — human-readable "2 days ago" for the Journal card
 *   • avatarEmoji — driven by the user's latest mood
 *
 * Reads local `melloStorage` first (always available, instant). If we have a
 * backend access token + user id, we additionally fetch today's journal
 * entries from the backend so the chip is accurate when a user journals on
 * another device. Backend failure is non-fatal — local wins.
 */

import { authGet } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import {
  getCheckInStreak,
  getJournalEntries,
  getMoodCheckIns,
  type JournalEntry,
  type MoodCheckIn,
} from '@/utils/melloStorage';
import { computeBattery } from '@/utils/emotionalBattery';
import { getAvatarEmojiForMood } from '@/utils/avatarEmoji';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface HomeStats {
  /** 0–100, or null when no mood check-in has been recorded yet. */
  battery: number | null;
  /** Consecutive days of engagement (mood or journal). */
  streak: number;
  /** Any journal entry dated today. */
  journaledToday: boolean;
  /** e.g. "Today", "Yesterday", "3 days ago", or null if never journaled. */
  lastJournalAgo: string | null;
  /** Emoji mirroring the user's latest mood. */
  avatarEmoji: string;
}

function localDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function humanAgo(fromMs: number): string {
  const days = Math.floor((Date.now() - fromMs) / MS_PER_DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * Compute engagement streak from mood + journal history.
 * Counts consecutive days ending today (or yesterday if user hasn't engaged
 * today yet — don't break the streak before midnight).
 */
function computeStreak(
  moodCheckins: MoodCheckIn[],
  journalEntries: JournalEntry[],
): number {
  const activeDays = new Set<string>();
  for (const c of moodCheckins) activeDays.add(localDateKey(new Date(c.createdAt).getTime()));
  for (const j of journalEntries) activeDays.add(localDateKey(new Date(j.createdAt).getTime()));

  if (activeDays.size === 0) return 0;

  const now = Date.now();
  const todayKey = localDateKey(now);
  const yesterdayKey = localDateKey(now - MS_PER_DAY);

  // Starting anchor: today if active today, else yesterday if active yesterday,
  // else streak is zero (gap too large).
  let cursor: number;
  if (activeDays.has(todayKey)) cursor = now;
  else if (activeDays.has(yesterdayKey)) cursor = now - MS_PER_DAY;
  else return 0;

  let count = 0;
  while (activeDays.has(localDateKey(cursor))) {
    count += 1;
    cursor -= MS_PER_DAY;
  }
  return count;
}

/**
 * Try to fetch today's journal entries from the backend. Non-fatal.
 */
async function fetchJournaledTodayFromBackend(
  userId: string,
  accessToken: string,
): Promise<boolean | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const iso = todayStart.toISOString();
  const url =
    `${ENDPOINTS.JOURNAL_ENTRIES}?user_id=eq.${encodeURIComponent(userId)}` +
    `&created_at=gte.${encodeURIComponent(iso)}&limit=1`;

  console.log('[homeStatsService] → GET', url);
  const started = Date.now();
  const { data, error } = await authGet<unknown[]>(url, accessToken);
  const ms = Date.now() - started;
  if (error) {
    console.warn(
      `[homeStatsService] ← GET ${url} FAILED (${ms}ms) status=${error.status} code=${error.code ?? '-'} msg=${error.message}`,
    );
    return null;
  }
  const found = Array.isArray(data) && data.length > 0;
  console.log(
    `[homeStatsService] ← GET ${url} OK (${ms}ms) journaledToday=${found}`,
  );
  return found;
}

export interface LoadHomeStatsOptions {
  userId?: string | null;
  accessToken?: string | null;
}

export async function loadHomeStats(opts: LoadHomeStatsOptions = {}): Promise<HomeStats> {
  const [moodCheckins, journalEntries, localStreak] = await Promise.all([
    getMoodCheckIns(),
    getJournalEntries(),
    getCheckInStreak().catch(() => null),
  ]);

  const { value: battery, latestMoodId } = computeBattery({
    moodCheckins,
    journalEntries,
  });

  // Prefer the locally-maintained streak counter (updated on each check-in
  // via `updateStreak()`), but fall back to a recomputed value if the stored
  // counter is zero but we actually have engagement history.
  const recomputed = computeStreak(moodCheckins, journalEntries);
  const streak = Math.max(localStreak?.currentStreak ?? 0, recomputed);

  const todayKey = localDateKey(Date.now());
  const localJournaledToday = journalEntries.some(
    (j) => localDateKey(new Date(j.createdAt).getTime()) === todayKey,
  );

  let journaledToday = localJournaledToday;
  if (!journaledToday && opts.userId && opts.accessToken) {
    const remote = await fetchJournaledTodayFromBackend(opts.userId, opts.accessToken);
    if (remote === true) journaledToday = true;
  }

  const lastJournalAgo =
    journalEntries.length > 0
      ? humanAgo(new Date(journalEntries[0].createdAt).getTime())
      : null;

  return {
    battery,
    streak,
    journaledToday,
    lastJournalAgo,
    avatarEmoji: getAvatarEmojiForMood(latestMoodId),
  };
}
