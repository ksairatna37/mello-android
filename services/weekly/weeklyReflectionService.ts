import { fetchCheckins, type MoodCheckin } from '@/services/mood/moodService';
import {
  fetchEntries,
  SAVED_CHAT_TAG,
  type JournalEntry,
} from '@/services/journal/journalService';
import {
  listFeatureUsesBetween,
  type FeatureUseEvent,
} from '@/services/home/featureUsageService';

export interface WeeklyTopItem {
  label: string;
  count: number;
}

export interface WeeklyCarryLine {
  line: string;
  attribution: string;
}

export interface WeeklyReflection {
  now: Date;
  weekStart: Date;
  weekEnd: Date;
  headerLabel: string;
  showedUp: boolean[];
  showedUpCount: number;
  topItems: WeeklyTopItem[];
  carry: WeeklyCarryLine | null;
  ask: {
    text: string;
    button: string;
    reminderDate: Date;
  };
}

const DAY_MS = 86_400_000;

export async function loadWeeklyReflection(now = new Date()): Promise<WeeklyReflection> {
  const weekStart = startOfWeekMonday(now);
  const weekEnd = endOfDay(addDays(weekStart, 6));
  const [checkinsResult, entriesResult, featureUses] = await Promise.all([
    fetchCheckins().catch(() => ({ ok: false as const, error: 'load failed' })),
    fetchEntries().catch(() => ({ ok: false as const, error: 'load failed' })),
    listFeatureUsesBetween(weekStart, endOfDay(now)).catch(() => []),
  ]);

  const checkins = checkinsResult.ok ? checkinsResult.data : [];
  const entries = entriesResult.ok ? entriesResult.data : [];

  return buildWeeklyReflection({
    now,
    weekStart,
    weekEnd,
    checkins,
    entries,
    featureUses,
  });
}

export function buildWeeklyReflection(args: {
  now: Date;
  weekStart: Date;
  weekEnd: Date;
  checkins: MoodCheckin[];
  entries: JournalEntry[];
  featureUses: FeatureUseEvent[];
}): WeeklyReflection {
  const nowDay = localDayKey(args.now);
  const weekEntries = args.entries.filter((entry) => isWithin(entry.createdAt, args.weekStart, args.weekEnd));
  const weekFeatureUses = args.featureUses.filter((event) => isWithin(event.createdAt, args.weekStart, args.weekEnd));
  const showedUp = buildShowedUpGrid({
    weekStart: args.weekStart,
    now: args.now,
    checkins: args.checkins,
    entries: weekEntries,
    featureUses: weekFeatureUses,
  });
  const topItems = buildTopItems({
    checkins: args.checkins.filter((item) => isWeekDate(item.date, args.weekStart, args.weekEnd)),
    entries: weekEntries,
    featureUses: weekFeatureUses,
  });
  const carry = buildCarryLine(weekEntries);
  const reminderDate = nextSundayAt(args.now, 16);

  return {
    now: args.now,
    weekStart: args.weekStart,
    weekEnd: args.weekEnd,
    headerLabel: `${formatDayDate(args.now)} · week of ${formatMonthDay(args.weekStart)}`,
    showedUp,
    showedUpCount: showedUp.filter(Boolean).length,
    topItems,
    carry,
    ask: {
      text: pickAsk(nowDay, topItems),
      button: `Add to ${formatWeekday(reminderDate)}s, ${formatHour(reminderDate)}`,
      reminderDate,
    },
  };
}

function buildShowedUpGrid(args: {
  weekStart: Date;
  now: Date;
  checkins: MoodCheckin[];
  entries: JournalEntry[];
  featureUses: FeatureUseEvent[];
}): boolean[] {
  const todayKey = localDayKey(args.now);
  const activeDays = new Set<string>();
  for (const c of args.checkins) activeDays.add(c.date);
  for (const e of args.entries) activeDays.add(localDayKey(new Date(e.createdAt)));
  for (const f of args.featureUses) activeDays.add(localDayKey(new Date(f.createdAt)));

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(args.weekStart, i);
    const key = localDayKey(date);
    if (key > todayKey) return false;
    return activeDays.has(key);
  });
}

function buildTopItems(args: {
  checkins: MoodCheckin[];
  entries: JournalEntry[];
  featureUses: FeatureUseEvent[];
}): WeeklyTopItem[] {
  const totals = new Map<string, number>();

  for (const event of args.featureUses) {
    add(totals, event.label);
  }
  for (const entry of args.entries) {
    if (entry.source === 'chat' || entry.tags?.includes(SAVED_CHAT_TAG)) add(totals, 'saved chat');
    else if (entry.source === 'voice') add(totals, 'voice');
    else add(totals, 'journal');
  }
  for (const checkin of args.checkins) {
    if (checkin.mood || checkin.battery !== undefined) add(totals, 'mood');
  }

  return [...totals.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 4);
}

function buildCarryLine(entries: JournalEntry[]): WeeklyCarryLine | null {
  const latest = entries[0];
  if (!latest?.body && !latest?.title) return null;
  const raw = (latest.body || latest.title || '').trim();
  const firstSentence = raw.match(/^[\s\S]+?[.!?](?=\s|$)/)?.[0]?.trim();
  const line = (firstSentence || raw.slice(0, 120).trim()).replace(/^Saved chat —\s*/i, 'Saved chat — ');
  return { line, attribution: attribution(latest.createdAt) };
}

function pickAsk(dayKey: string, topItems: WeeklyTopItem[]): string {
  const top = topItems[0]?.label;
  if (top === 'saved chat' || top === 'chat') return 'A tiny chat check-in before the week gets loud.';
  if (top === 'journal') return 'A 3-min note to your future self.';
  if (top === 'mood') return 'One honest mood tap after lunch.';
  if (top === 'sound space') return 'One quiet room before bed.';
  return dayKey ? 'A 3-min Sunday afternoon check-in.' : 'A small check-in next week.';
}

function add(map: Map<string, number>, label: string): void {
  map.set(label, (map.get(label) ?? 0) + 1);
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const offset = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function nextSundayAt(date: Date, hour: number): Date {
  const d = new Date(date);
  const daysUntilSunday = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isWithin(iso: string | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime();
  return ms >= start.getTime() && ms <= end.getTime();
}

function isWeekDate(dateKey: string, start: Date, end: Date): boolean {
  return dateKey >= localDayKey(start) && dateKey <= localDayKey(end);
}

function localDayKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).toLowerCase();
}

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
}

function formatWeekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function formatHour(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).toLowerCase().replace(' ', '');
}

function attribution(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const time = d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase()
    .replace(' ', '');
  return `— you, ${day} ${time}`;
}
