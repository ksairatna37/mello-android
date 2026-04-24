/**
 * Emotional battery — composite wellbeing signal (0–100).
 *
 * Inspired by multi-factor wellbeing scores (MHQ, MoodPrism, NIH Toolbox):
 * mood + activity + consistency + recency combine into a single glanceable
 * percentage the user sees on Home. Never hardcoded.
 *
 * Factor weights:
 *   40 % mood       — latest check-in, decayed by age
 *   25 % activity   — today's engagement (journal / mood / voice)
 *   20 % consistency — distinct active days in the last 7
 *   15 % recency     — exponential decay of hours since last check-in
 *
 * Returns null when we don't yet have a mood check-in to anchor on — the UI
 * shows a "Tap to check in" CTA instead of a fake value.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMoodCheckIns,
  getJournalEntries,
  type MoodCheckIn,
  type JournalEntry,
} from '@/utils/melloStorage';

const CACHE_KEY = '@mello/battery_snapshot';
const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

const MOOD_SCORE_01: Record<string, number> = {
  great: 1.0,
  good: 0.8,
  okay: 0.6,
  low: 0.3,
  rough: 0.1,
};

export interface BatterySnapshot {
  value: number;
  computedAt: number;
  latestMoodId: string | null;
}

export interface BatteryInputs {
  moodCheckins: MoodCheckIn[];
  journalEntries: JournalEntry[];
  /** Optional extra activity timestamps (e.g. voice sessions) in ms. */
  extraActivityTimestamps?: number[];
}

function dateKey(ms: number): string {
  return new Date(ms).toISOString().split('T')[0];
}

export function computeBattery({
  moodCheckins,
  journalEntries,
  extraActivityTimestamps = [],
}: BatteryInputs): { value: number | null; latestMoodId: string | null } {
  if (moodCheckins.length === 0) {
    return { value: null, latestMoodId: null };
  }

  const now = Date.now();
  const latestMood = moodCheckins[0];
  const latestMoodTs = new Date(latestMood.createdAt).getTime();
  const hoursSinceMood = Math.max(0, (now - latestMoodTs) / MS_PER_HOUR);

  // ── 1. Mood factor (0–1), decayed by age. Half-life ~ 48h.
  const rawMood = MOOD_SCORE_01[latestMood.moodId] ?? 0.5;
  const moodFreshness = Math.exp(-hoursSinceMood / 48);
  const moodFactor = rawMood * moodFreshness + 0.5 * (1 - moodFreshness);
  // When stale, drift toward neutral 0.5 rather than overstating a happy mood
  // from three days ago.

  // ── 2. Activity factor — did they engage today / yesterday?
  const todayKey = dateKey(now);
  const yesterdayKey = dateKey(now - MS_PER_DAY);
  const activityDays = new Set<string>();
  for (const c of moodCheckins) activityDays.add(dateKey(new Date(c.createdAt).getTime()));
  for (const j of journalEntries) activityDays.add(dateKey(new Date(j.createdAt).getTime()));
  for (const ts of extraActivityTimestamps) activityDays.add(dateKey(ts));

  let activityFactor = 0;
  if (activityDays.has(todayKey)) activityFactor = 1;
  else if (activityDays.has(yesterdayKey)) activityFactor = 0.5;

  // ── 3. Consistency — distinct active days in last 7.
  let activeDaysLast7 = 0;
  for (let i = 0; i < 7; i++) {
    if (activityDays.has(dateKey(now - i * MS_PER_DAY))) activeDaysLast7 += 1;
  }
  const consistencyFactor = activeDaysLast7 / 7;

  // ── 4. Recency — exponential decay of hours since latest check-in.
  const recencyFactor = Math.exp(-hoursSinceMood / 48);

  const composite =
    0.4 * moodFactor +
    0.25 * activityFactor +
    0.2 * consistencyFactor +
    0.15 * recencyFactor;

  const value = Math.round(Math.max(0, Math.min(1, composite)) * 100);
  return { value, latestMoodId: latestMood.moodId };
}

export async function loadBattery(): Promise<BatterySnapshot | null> {
  const [moodCheckins, journalEntries] = await Promise.all([
    getMoodCheckIns(),
    getJournalEntries(),
  ]);
  const { value, latestMoodId } = computeBattery({ moodCheckins, journalEntries });
  if (value === null) return null;
  const snapshot: BatterySnapshot = {
    value,
    computedAt: Date.now(),
    latestMoodId,
  };
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore cache write failures — the computed value is still valid.
  }
  return snapshot;
}

export async function loadCachedBattery(): Promise<BatterySnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BatterySnapshot;
  } catch {
    return null;
  }
}
