/**
 * Mello Storage Utility
 * Manages journal entries, mood check-ins, and streaks via AsyncStorage
 * Same adapter pattern as onboardingStorage.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface JournalEntry {
  id: string;
  content: string;
  emotion: string;
  emotionEmoji: string;
  photoUri?: string;
  createdAt: string;
  prompt?: string;
}

export interface MoodCheckIn {
  id: string;
  moodId: string;
  moodLabel: string;
  date: string;
  createdAt: string;
}

export interface CheckInStreak {
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate: string;
  totalCheckIns: number;
}

// ═══════════════════════════════════════════════════════════════════
// KEYS
// ═══════════════════════════════════════════════════════════════════

const KEYS = {
  JOURNAL: '@mello/journal_entries',
  CHECKINS: '@mello/mood_checkins',
  STREAK: '@mello/checkin_streak',
};

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

const MOOD_SCORES: Record<string, number> = {
  great: 5,
  good: 4,
  okay: 3,
  low: 2,
  rough: 1,
};

// ═══════════════════════════════════════════════════════════════════
// JOURNAL
// ═══════════════════════════════════════════════════════════════════

export async function getJournalEntries(): Promise<JournalEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.JOURNAL);
  if (!raw) return [];
  const entries: JournalEntry[] = JSON.parse(raw);
  return entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function addJournalEntry(
  entry: Omit<JournalEntry, 'id' | 'createdAt'>
): Promise<JournalEntry> {
  const entries = await getJournalEntries();
  const newEntry: JournalEntry = {
    ...entry,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  entries.unshift(newEntry);
  await AsyncStorage.setItem(KEYS.JOURNAL, JSON.stringify(entries));
  return newEntry;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const entries = await getJournalEntries();
  const filtered = entries.filter((e) => e.id !== id);
  await AsyncStorage.setItem(KEYS.JOURNAL, JSON.stringify(filtered));
}

// ═══════════════════════════════════════════════════════════════════
// MOOD CHECK-INS
// ═══════════════════════════════════════════════════════════════════

export async function getMoodCheckIns(limit?: number): Promise<MoodCheckIn[]> {
  const raw = await AsyncStorage.getItem(KEYS.CHECKINS);
  if (!raw) return [];
  const checkins: MoodCheckIn[] = JSON.parse(raw);
  const sorted = checkins.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function getMoodCheckInsForRange(
  startDate: string,
  endDate: string
): Promise<MoodCheckIn[]> {
  const checkins = await getMoodCheckIns();
  return checkins.filter((c) => c.date >= startDate && c.date <= endDate);
}

export async function addMoodCheckIn(
  moodId: string,
  moodLabel: string
): Promise<MoodCheckIn> {
  const checkins = await getMoodCheckIns();
  const today = getTodayDate();

  // Replace existing check-in for today if any
  const filtered = checkins.filter((c) => c.date !== today);

  const newCheckIn: MoodCheckIn = {
    id: Date.now().toString(),
    moodId,
    moodLabel,
    date: today,
    createdAt: new Date().toISOString(),
  };

  filtered.unshift(newCheckIn);
  await AsyncStorage.setItem(KEYS.CHECKINS, JSON.stringify(filtered));
  return newCheckIn;
}

export async function hasCheckedInToday(): Promise<boolean> {
  const checkins = await getMoodCheckIns();
  const today = getTodayDate();
  return checkins.some((c) => c.date === today);
}

export async function getTodayCheckIn(): Promise<MoodCheckIn | null> {
  const checkins = await getMoodCheckIns();
  const today = getTodayDate();
  return checkins.find((c) => c.date === today) || null;
}

// ═══════════════════════════════════════════════════════════════════
// STREAKS
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_STREAK: CheckInStreak = {
  currentStreak: 0,
  longestStreak: 0,
  lastCheckInDate: '',
  totalCheckIns: 0,
};

export async function getCheckInStreak(): Promise<CheckInStreak> {
  const raw = await AsyncStorage.getItem(KEYS.STREAK);
  if (!raw) return DEFAULT_STREAK;
  return JSON.parse(raw);
}

export async function updateStreak(): Promise<CheckInStreak> {
  const streak = await getCheckInStreak();
  const today = getTodayDate();

  // Already updated today
  if (streak.lastCheckInDate === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak: CheckInStreak;

  if (streak.lastCheckInDate === yesterdayStr) {
    // Consecutive day
    const current = streak.currentStreak + 1;
    newStreak = {
      currentStreak: current,
      longestStreak: Math.max(current, streak.longestStreak),
      lastCheckInDate: today,
      totalCheckIns: streak.totalCheckIns + 1,
    };
  } else {
    // Streak broken or first check-in
    newStreak = {
      currentStreak: 1,
      longestStreak: Math.max(1, streak.longestStreak),
      lastCheckInDate: today,
      totalCheckIns: streak.totalCheckIns + 1,
    };
  }

  await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(newStreak));
  return newStreak;
}

// ═══════════════════════════════════════════════════════════════════
// MOOD SCORES (for charting)
// ═══════════════════════════════════════════════════════════════════

export async function getMoodScores(
  days: number
): Promise<{ date: string; score: number }[]> {
  const endDate = getTodayDate();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  const startDate = start.toISOString().split('T')[0];

  const checkins = await getMoodCheckInsForRange(startDate, endDate);

  return checkins
    .map((c) => ({
      date: c.date,
      score: MOOD_SCORES[c.moodId] ?? 3,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
