import AsyncStorage from '@react-native-async-storage/async-storage';

type GreetingBucket =
  | 'any'
  | 'returning'
  | 'earlyMorning'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'lateNight'
  | 'veryLate'
  | 'weekend';

type TimeBucket =
  | 'earlyMorning'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'lateNight'
  | 'veryLate';

const RECENT_KEY = 'selfmind:recentHomeGreetings';
const RECENT_MEMORY = 4;

const greetings: Record<GreetingBucket, string[]> = {
  any: [
    'soft landing',
    'pull up a seat',
    'come on in',
    'no rush',
    'take your time',
    'glad you came by',
    'this space is yours',
    'ready when you are',
    'whenever you are ready',
    'you made it here. that counts.',
  ],
  returning: [
    'welcome back, {name}',
    'good to see you, {name}',
    'there you are, {name}',
    'hi again, {name}',
    '{name}, hey',
  ],
  earlyMorning: [
    'soft start?',
    'slow morning?',
    'the world is still quiet',
    'easing in',
    'morning, gently',
  ],
  morning: [
    'fresh page',
    'new day energy',
    'morning check-in?',
    'what is the morning like?',
  ],
  afternoon: [
    'afternoon pause',
    'sneaking a moment?',
    'quick breather?',
    'halfway-through-the-day check-in',
  ],
  evening: [
    'winding down?',
    'decompress mode?',
    'how did today land?',
    'end-of-day debrief?',
  ],
  lateNight: [
    "it's late night",
    'up late?',
    'still up?',
    'the quiet hours',
    'late-night thoughts?',
    'late-night thoughts zone',
    'brain still going?',
  ],
  veryLate: [
    'still awake?',
    'soft hours',
    'the in-between time',
    'I am here. no rush.',
  ],
  weekend: [
    'happy weekend',
    'slow weekend?',
    'no rules today',
    'weekend mode',
  ],
};

export interface PickGreetingOptions {
  name?: string;
  now?: Date;
  isReturning?: boolean;
}

export async function pickGreeting(opts: PickGreetingOptions = {}): Promise<string> {
  const rendered = pickGreetingFromPool(opts, await getRecent());
  await pushRecent(rendered.key);
  return rendered.text;
}

function pickGreetingFromPool(
  opts: PickGreetingOptions,
  recent: string[],
): { key: string; text: string } {
  const { name, now = new Date(), isReturning = true } = opts;
  const timeBucket = getTimeBucket(now);
  const weekend = isWeekend(now);
  const isOvernight = timeBucket === 'lateNight' || timeBucket === 'veryLate';

  const pool = isOvernight
    ? [
        ...greetings[timeBucket],
        ...greetings[timeBucket],
        ...greetings[timeBucket],
      ]
    : [
        ...greetings[timeBucket],
        ...greetings[timeBucket],
        ...greetings.any,
        ...(weekend ? greetings.weekend : []),
        ...(isReturning ? greetings.returning : []),
      ];

  const usable = pool.filter((g) => name || !g.includes('{name}'));
  const fresh = usable.filter((g) => !recent.includes(g));
  const finalPool = fresh.length > 0 ? fresh : usable;
  const key = finalPool[Math.floor(Math.random() * finalPool.length)] ?? 'soft landing';
  return {
    key,
    text: name ? key.replace(/\{name\}/g, name) : key,
  };
}

export function getTimeBucket(date: Date): TimeBucket {
  // Intentionally use device-local time. Greeting copy should follow the
  // user's wall clock, not UTC or server time.
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

async function getRecent(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function pushRecent(greeting: string): Promise<void> {
  try {
    const recent = await getRecent();
    const next = [greeting, ...recent.filter((g) => g !== greeting)].slice(0, RECENT_MEMORY);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Greeting rotation should never block the home screen.
  }
}
