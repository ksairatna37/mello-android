import AsyncStorage from '@react-native-async-storage/async-storage';

type TimeBucket = 'earlyMorning' | 'morning' | 'afternoon' | 'evening' | 'lateNight' | 'veryLate';
type ChipBucket = TimeBucket | 'any' | 'weekend' | 'heavy' | 'sleep' | 'social';

const RECENT_KEY = 'selfmind:recentChatGreetingChips';
const RECENT_MEMORY = 12;
const CHIP_COUNT = 4;

const chips: Record<ChipBucket, string[]> = {
  any: [
    "i'm anxious",
    'need to vent',
    'just checking in',
    'feeling a lot',
    'help me sort this',
    'i need a soft reset',
    'can we untangle something?',
    'i do not know where to start',
    'i need a tiny pause',
    'something feels off',
    'i want to think out loud',
    'can you sit with me?',
  ],
  earlyMorning: [
    'woke up uneasy',
    'starting slow today',
    'morning feels heavy',
    'need a gentle start',
  ],
  morning: [
    'today feels like a lot',
    'morning check-in',
    'i need to ground myself',
    'can we plan gently?',
  ],
  afternoon: [
    'midday overwhelm',
    'i need a breather',
    'work is getting to me',
    'my brain feels crowded',
  ],
  evening: [
    'today was a lot',
    'need to decompress',
    'evening check-in',
    'something followed me home',
  ],
  lateNight: [
    "can't sleep",
    'thoughts are loud',
    'late-night spiral',
    'help me wind down',
  ],
  veryLate: [
    'still awake',
    'quiet hours check-in',
    'my mind will not stop',
    'help me feel less alone',
  ],
  weekend: [
    'weekend feels weird',
    'slow day check-in',
    'no-pressure reset',
    'i need some clarity',
  ],
  heavy: [
    'feeling down',
    'i need support',
    'things feel heavy',
    'i feel alone',
  ],
  sleep: [
    "can't sleep",
    'help me wind down',
    'night thoughts',
    'my body is tired',
  ],
  social: [
    'checking in with someone',
    'friend stuff',
    'relationship thoughts',
    'i need help saying this',
  ],
};

export interface PickChatGreetingChipsOptions {
  now?: Date;
  contextText?: string;
}

export async function pickChatGreetingChips(
  opts: PickChatGreetingChipsOptions = {},
): Promise<string[]> {
  const picked = pickChipsFromPool(opts, await getRecent());
  await pushRecent(picked);
  return picked;
}

function pickChipsFromPool(opts: PickChatGreetingChipsOptions, recent: string[]): string[] {
  const now = opts.now ?? new Date();
  const timeBucket = getTimeBucket(now);
  const contextBuckets = getContextBuckets(opts.contextText ?? '');
  const pool = [
    ...chips[timeBucket],
    ...chips[timeBucket],
    ...contextBuckets.flatMap((bucket) => chips[bucket]),
    ...chips.any,
    ...(isWeekend(now) ? chips.weekend : []),
  ];

  const unique = Array.from(new Set(pool));
  const fresh = unique.filter((chip) => !recent.includes(chip));
  const finalPool = fresh.length >= CHIP_COUNT ? fresh : unique;
  return shuffle(finalPool).slice(0, CHIP_COUNT);
}

function getContextBuckets(text: string): ChipBucket[] {
  const t = text.toLowerCase();
  const buckets: ChipBucket[] = [];
  if (/(sleep|awake|night|tired|wind down)/.test(t)) buckets.push('sleep');
  if (/(heavy|down|alone|support|carrying)/.test(t)) buckets.push('heavy');
  if (/(friend|relationship|home|company)/.test(t)) buckets.push('social');
  return buckets;
}

function getTimeBucket(date: Date): TimeBucket {
  const h = date.getHours();
  if (h >= 5 && h < 8) return 'earlyMorning';
  if (h >= 8 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  if (h >= 21 || h < 2) return 'lateNight';
  return 'veryLate';
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function getRecent(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function pushRecent(nextChips: string[]): Promise<void> {
  try {
    const recent = await getRecent();
    const next = [...nextChips, ...recent.filter((chip) => !nextChips.includes(chip))]
      .slice(0, RECENT_MEMORY);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Chip rotation should never block the chat screen.
  }
}
