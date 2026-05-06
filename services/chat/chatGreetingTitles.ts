import AsyncStorage from '@react-native-async-storage/async-storage';

type TimeBucket = 'earlyMorning' | 'morning' | 'afternoon' | 'evening' | 'lateNight' | 'veryLate';

const RECENT_KEY = 'selfmind:recentChatGreetingTitles';
const RECENT_MEMORY = 4;

const titles: Record<TimeBucket | 'any' | 'weekend', string[]> = {
  any: [
    "What's floating around?",
    'What are we carrying today?',
    'Where should we begin?',
    'What wants a little airtime?',
    'What should we untangle?',
    'What is asking for attention?',
    'What are we making room for?',
  ],
  earlyMorning: [
    'What woke up with you?',
    'Soft start, what is here?',
    'What is stirring this morning?',
  ],
  morning: [
    'What is the morning bringing?',
    'What is on your plate today?',
    'Morning thoughts, where are we?',
  ],
  afternoon: [
    'Midday check-in, what is up?',
    'What is the day doing to you?',
    'Need a tiny pause?',
  ],
  evening: [
    'How did today land?',
    'Evening debrief?',
    'What followed you home?',
    'What needs to come off your chest?',
  ],
  lateNight: [
    'Brain still buzzing?',
    'What is keeping you company tonight?',
    'Late-night thoughts?',
    'What is awake in you?',
  ],
  veryLate: [
    'Still awake, what is here?',
    'Tiny-hours check-in?',
    'What is moving through the quiet?',
  ],
  weekend: [
    'Weekend brain, what is up?',
    'Slow day check-in?',
    'No-rules check-in?',
  ],
};

export interface PickChatGreetingTitleOptions {
  now?: Date;
}

export async function pickChatGreetingTitle(opts: PickChatGreetingTitleOptions = {}): Promise<string> {
  const rendered = pickTitleFromPool(opts, await getRecent());
  await pushRecent(rendered.key);
  return rendered.text;
}

function pickTitleFromPool(
  opts: PickChatGreetingTitleOptions,
  recent: string[],
): { key: string; text: string } {
  const now = opts.now ?? new Date();
  const timeBucket = getTimeBucket(now);
  const pool = [
    ...titles[timeBucket],
    ...titles[timeBucket],
    ...titles.any,
    ...(isWeekend(now) ? titles.weekend : []),
  ];
  const fresh = pool.filter((title) => !recent.includes(title));
  const finalPool = fresh.length > 0 ? fresh : pool;
  const key = finalPool[Math.floor(Math.random() * finalPool.length)] ?? "What's floating around?";
  return { key, text: key };
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

async function getRecent(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function pushRecent(title: string): Promise<void> {
  try {
    const recent = await getRecent();
    const next = [title, ...recent.filter((item) => item !== title)].slice(0, RECENT_MEMORY);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Title rotation should never block the chat screen.
  }
}
