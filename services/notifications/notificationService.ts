import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getOnboardingData } from '@/utils/onboardingStorage';
import type { MoodCheckin } from '@/services/mood/moodService';
import type { MoodId } from '@/components/mood/MoodDot';

export type NotificationKind =
  | 'daily_checkin'
  | 'weekly_reflection'
  | 'mood_pattern'
  | 'voice_followup'
  | 'journal_prompt'
  | 'practice_nudge'
  | 'sound_space';

export interface MelloNotification {
  id: string;
  dedupeKey: string;
  kind: NotificationKind;
  title: string;
  body: string;
  eyebrow: string;
  route?: string;
  params?: Record<string, string>;
  createdAt: string;
  scheduledFor?: string;
  readAt?: string;
  dismissedAt?: string;
  nativeNotificationId?: string;
  source: 'local';
}

type UpsertInput = Omit<MelloNotification, 'id' | 'createdAt' | 'source'> & {
  id?: string;
  createdAt?: string;
};

const STORE_KEY = 'mello:notifications:v1';
const MAX_ITEMS = 60;
const ANDROID_CHANNEL_ID = 'mello-soft-nudges';

let runtimeConfigured = false;

export async function configureNotificationRuntime(): Promise<void> {
  if (runtimeConfigured) return;
  runtimeConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Soft nudges',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: undefined,
      vibrationPattern: [0, 120, 80, 120],
      lightColor: '#F4A988',
    });
  }
}

export async function listNotifications(): Promise<MelloNotification[]> {
  const items = await readAll();
  return items
    .filter((item) => !item.dismissedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function unreadCount(): Promise<number> {
  const items = await listNotifications();
  return items.filter((item) => !item.readAt).length;
}

export async function markNotificationRead(id: string): Promise<void> {
  const now = new Date().toISOString();
  await updateAll((items) =>
    items.map((item) => (
      item.id === id && !item.readAt ? { ...item, readAt: now } : item
    )),
  );
}

export async function markAllNotificationsRead(): Promise<void> {
  const now = new Date().toISOString();
  await updateAll((items) =>
    items.map((item) => (item.readAt ? item : { ...item, readAt: now })),
  );
}

export async function dismissNotification(id: string): Promise<void> {
  const now = new Date().toISOString();
  await updateAll((items) =>
    items.map((item) => (
      item.id === id ? { ...item, dismissedAt: now, readAt: item.readAt ?? now } : item
    )),
  );
}

export async function upsertNotification(input: UpsertInput): Promise<MelloNotification> {
  const now = new Date().toISOString();
  let saved: MelloNotification | null = null;
  await updateAll((items) => {
    const existing = items.find((item) => item.dedupeKey === input.dedupeKey);
    if (existing) {
      saved = {
        ...existing,
        ...input,
        id: existing.id,
        createdAt: input.createdAt ?? existing.createdAt,
        source: 'local',
      };
      return [saved, ...items.filter((item) => item.id !== existing.id)].slice(0, MAX_ITEMS);
    }

    saved = {
      ...input,
      id: input.id ?? makeId(input.kind),
      createdAt: input.createdAt ?? now,
      source: 'local',
    };
    return [saved, ...items].slice(0, MAX_ITEMS);
  });

  return saved!;
}

export async function createVoiceFollowup(args: {
  sessionId: string;
  summary?: string | null;
  when: Date;
}): Promise<MelloNotification> {
  const body = args.summary?.trim()
    ? trimLine(args.summary.trim(), 92)
    : 'You asked to come back to that session. Tiny revisit, no pressure.';

  const item = await upsertNotification({
    dedupeKey: `voice-followup:${args.sessionId}:${localDayKey(args.when)}`,
    kind: 'voice_followup',
    eyebrow: formatWhen(args.when),
    title: 'That thought is saved a little closer.',
    body,
    route: '/voice-summary',
    params: { id: args.sessionId },
    scheduledFor: args.when.toISOString(),
  });

  const nativeNotificationId = await scheduleNativeNotification(item, args.when);
  if (!nativeNotificationId) return item;

  return upsertNotification({
    ...item,
    nativeNotificationId,
  });
}

export async function createWeeklyCheckinReminder(args: {
  when: Date;
}): Promise<MelloNotification> {
  const item = await upsertNotification({
    dedupeKey: `weekly-checkin-reminder:${weekKey(args.when)}`,
    kind: 'weekly_reflection',
    eyebrow: formatWhen(args.when),
    title: 'A tiny weekly check-in is waiting.',
    body: 'Three minutes to notice the pattern. No scorekeeping.',
    route: '/weekly',
    scheduledFor: args.when.toISOString(),
  });

  const nativeNotificationId = await scheduleNativeNotification(item, args.when);
  if (!nativeNotificationId) return item;

  return upsertNotification({
    ...item,
    nativeNotificationId,
  });
}

export async function generateHomeNotifications(args: {
  todaysMood?: MoodId | null;
  checkins?: MoodCheckin[];
  now?: Date;
} = {}): Promise<void> {
  const now = args.now ?? new Date();
  const data = await getOnboardingData().catch(() => null);
  const name = data?.firstName?.trim();
  const mood = args.todaysMood ?? null;
  const dayKey = localDayKey(now);

  if (!mood && isCheckinWindow(now)) {
    await upsertNotification({
      dedupeKey: `daily-checkin:${dayKey}`,
      kind: 'daily_checkin',
      eyebrow: timeEyebrow(now),
      title: name ? `${name}, tiny weather report?` : 'Tiny weather report?',
      body: pick([
        'No essay. Just a small “how am I, actually?”',
        'One tap is enough. The day can stay messy.',
        'Want to name the mood before the day runs off with it?',
      ]),
      route: '/home',
    });
  }

  if (mood === 'notGood' || mood === 'meh') {
    await upsertNotification({
      dedupeKey: `mood-soft-support:${dayKey}`,
      kind: 'practice_nudge',
      eyebrow: timeEyebrow(now),
      title: mood === 'notGood' ? 'Let’s make the room smaller.' : 'A tiny reset is available.',
      body: mood === 'notGood'
        ? 'Two minutes of grounding. Nothing to solve, just a place to stand.'
        : 'Box breath is here if your brain has too many tabs open.',
      route: mood === 'notGood' ? '/grounding' : '/box-breath',
    });
  }

  if (isLate(now)) {
    await upsertNotification({
      dedupeKey: `late-sound-space:${dayKey}`,
      kind: 'sound_space',
      eyebrow: 'late night',
      title: 'Still awake?',
      body: 'Still Water can keep the lights low with you for a while.',
      route: '/space',
      params: { id: 'still-water' },
    });
  }

  if (isSundayReflectionWindow(now) && hasEnoughWeek(args.checkins ?? [])) {
    await upsertNotification({
      dedupeKey: `weekly-reflection:${weekKey(now)}`,
      kind: 'weekly_reflection',
      eyebrow: 'sunday note',
      title: 'Your week left a little trail.',
      body: 'Want to peek at the pattern without turning it into homework?',
      route: '/weekly',
    });
  }

  const streak = currentCheckinStreak(args.checkins ?? [], now);
  if (streak >= 3) {
    await upsertNotification({
      dedupeKey: `checkin-streak:${localDayKey(now)}:${streak}`,
      kind: 'mood_pattern',
      eyebrow: 'streak',
      title: `${streak} days in a row.`,
      body: 'A little trail is forming. Keep it gentle, keep it yours.',
      route: '/home',
    });
  }
}

export async function scheduleNativeNotification(
  item: MelloNotification,
  when: Date,
): Promise<string | null> {
  if (when.getTime() <= Date.now() + 15_000) return null;
  await configureNotificationRuntime();
  const granted = await ensurePermission();
  if (!granted) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: {
        title: item.title,
        body: item.body,
        data: {
          melloNotificationId: item.id,
          route: item.route,
          params: item.params,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
      },
    });
  } catch (error) {
    console.warn('[notificationService] schedule failed:', error);
    return null;
  }
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function readAll(): Promise<MelloNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNotification) : [];
  } catch {
    return [];
  }
}

async function updateAll(
  updater: (items: MelloNotification[]) => MelloNotification[],
): Promise<void> {
  const current = await readAll();
  const next = updater(current)
    .filter(isNotification)
    .slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
}

function isNotification(value: unknown): value is MelloNotification {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MelloNotification>;
  return (
    typeof item.id === 'string' &&
    typeof item.dedupeKey === 'string' &&
    typeof item.kind === 'string' &&
    typeof item.title === 'string' &&
    typeof item.body === 'string' &&
    typeof item.createdAt === 'string'
  );
}

function makeId(kind: NotificationKind): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function localDayKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function weekKey(date: Date): string {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return localDayKey(start);
}

function isCheckinWindow(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 9 && hour < 23;
}

function isLate(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 22 || hour < 5;
}

function isSundayReflectionWindow(date: Date): boolean {
  return date.getDay() === 0 && date.getHours() >= 16;
}

function hasEnoughWeek(checkins: MoodCheckin[]): boolean {
  const seen = new Set(checkins.slice(0, 8).map((item) => item.date));
  return seen.size >= 3;
}

function currentCheckinStreak(checkins: MoodCheckin[], now: Date): number {
  const seen = new Set(checkins.map((item) => item.date));
  let cursor = new Date(now);
  let count = 0;
  while (seen.has(localDayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function timeEyebrow(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'morning nudge';
  if (hour < 17) return 'midday nudge';
  if (hour < 22) return 'evening nudge';
  return 'late night';
}

function formatWhen(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = localDayKey(date) === localDayKey(now)
    ? 'tonight'
    : localDayKey(date) === localDayKey(tomorrow)
      ? 'tomorrow'
      : date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase().replace(' ', '');
  return `${day} · ${time}`;
}

function trimLine(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : oneLine.slice(0, max - 1).trimEnd() + '…';
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
