import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND as C } from '@/components/common/BrandGlyphs';
import type { MoodId } from '@/components/mood/MoodDot';

export type SuggestionGlyph = 'Leaf' | 'Book' | 'Wave' | 'Moon' | 'Sparkle' | 'Breath' | 'Sound';

export interface HomeSuggestion {
  id: string;
  title: string;
  sub: string;
  glyph: SuggestionGlyph;
  swatch: string;
  route: string;
  params?: Record<string, string>;
  kind: 'practice' | 'journal' | 'tool' | 'sound';
}

type TimeBucket = 'early' | 'morning' | 'afternoon' | 'evening' | 'late';

const RECENT_KEY = 'selfmind:recentHomeSuggestions';
const RECENT_MEMORY = 6;

const CATALOG: ReadonlyArray<HomeSuggestion> = [
  {
    id: 'grounding',
    title: '2 min grounding',
    sub: '5-4-3-2-1',
    glyph: 'Leaf',
    swatch: C.sage,
    route: '/grounding',
    kind: 'practice',
  },
  {
    id: 'box-breath',
    title: 'Box breath',
    sub: 'four slow sides',
    glyph: 'Breath',
    swatch: C.lavender,
    route: '/box-breath',
    kind: 'practice',
  },
  {
    id: 'brain-dump',
    title: 'Brain dump',
    sub: 'empty the tabs',
    glyph: 'Book',
    swatch: C.butter,
    route: '/brain-dump',
    kind: 'practice',
  },
  {
    id: 'reach-out',
    title: 'Reach out',
    sub: 'draft the text',
    glyph: 'Sparkle',
    swatch: C.lavender,
    route: '/reach-out',
    kind: 'practice',
  },
  {
    id: 'journal-prompt',
    title: 'Journal prompt',
    sub: 'what did today ask of you?',
    glyph: 'Book',
    swatch: C.butter,
    route: '/journal-prompt',
    kind: 'journal',
  },
  {
    id: 'weekly',
    title: 'Weekly reflection',
    sub: 'notice the pattern',
    glyph: 'Moon',
    swatch: C.lavender,
    route: '/weekly',
    kind: 'tool',
  },
  {
    id: 'progress',
    title: 'Mood progress',
    sub: 'look at the tide',
    glyph: 'Wave',
    swatch: C.peach,
    route: '/mood-history',
    kind: 'tool',
  },
  {
    id: 'sound-still-water',
    title: 'Still Water',
    sub: 'sound space',
    glyph: 'Sound',
    swatch: C.lavender,
    route: '/space',
    params: { id: 'still-water' },
    kind: 'sound',
  },
  {
    id: 'sound-weightless',
    title: 'Weightless',
    sub: 'sound space',
    glyph: 'Sound',
    swatch: C.peach,
    route: '/space',
    params: { id: 'weightless' },
    kind: 'sound',
  },
  {
    id: 'sound-ember',
    title: 'Ember',
    sub: 'sound space',
    glyph: 'Sound',
    swatch: C.coral,
    route: '/space',
    params: { id: 'ember' },
    kind: 'sound',
  },
  {
    id: 'sound-field-at-dusk',
    title: 'Field at Dusk',
    sub: 'sound space',
    glyph: 'Sound',
    swatch: C.lavender,
    route: '/space',
    params: { id: 'field-at-dusk' },
    kind: 'sound',
  },
  {
    id: 'sound-morning-light',
    title: 'Morning Light',
    sub: 'sound space',
    glyph: 'Sound',
    swatch: C.butter,
    route: '/space',
    params: { id: 'morning-light' },
    kind: 'sound',
  },
];

const MOOD_WEIGHTS: Record<MoodId, string[]> = {
  notGood: ['grounding', 'box-breath', 'sound-still-water', 'journal-prompt'],
  meh: ['brain-dump', 'sound-ember', 'journal-prompt', 'weekly'],
  ok: ['journal-prompt', 'sound-weightless', 'progress', 'grounding'],
  good: ['sound-morning-light', 'weekly', 'brain-dump', 'progress'],
  amazing: ['journal-prompt', 'sound-morning-light', 'weekly', 'reach-out'],
};

const TIME_WEIGHTS: Record<TimeBucket, string[]> = {
  early: ['grounding', 'sound-morning-light', 'journal-prompt'],
  morning: ['sound-morning-light', 'journal-prompt', 'brain-dump'],
  afternoon: ['box-breath', 'grounding', 'progress'],
  evening: ['journal-prompt', 'sound-field-at-dusk', 'weekly'],
  late: ['sound-weightless', 'sound-still-water', 'box-breath'],
};

export async function pickHomeSuggestions(opts: {
  mood?: MoodId | null;
  now?: Date;
} = {}): Promise<HomeSuggestion[]> {
  const now = opts.now ?? new Date();
  const recent = await getRecent();
  const weighted = buildWeightedPool(opts.mood ?? null, getTimeBucket(now));
  const picked = pickTwo(weighted, recent);
  await pushRecent(picked.map((s) => s.id));
  return picked;
}

function buildWeightedPool(mood: MoodId | null, timeBucket: TimeBucket): HomeSuggestion[] {
  const byId = new Map(CATALOG.map((item) => [item.id, item]));
  const ids = [
    ...TIME_WEIGHTS[timeBucket],
    ...TIME_WEIGHTS[timeBucket],
    ...(mood ? MOOD_WEIGHTS[mood] : []),
    ...(mood ? MOOD_WEIGHTS[mood] : []),
    ...CATALOG.map((item) => item.id),
  ];
  return ids.map((id) => byId.get(id)).filter(Boolean) as HomeSuggestion[];
}

function pickTwo(pool: HomeSuggestion[], recent: string[]): HomeSuggestion[] {
  const freshPool = pool.filter((item) => !recent.includes(item.id));
  const source = uniqueCount(freshPool) >= 2 ? freshPool : pool;
  const first = pickWeighted(source) ?? CATALOG[0];
  const second = pickWeighted(source.filter((item) => item.id !== first.id)) ?? CATALOG[1];
  return [first, second];
}

function pickWeighted(pool: HomeSuggestion[]): HomeSuggestion | undefined {
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

function uniqueCount(pool: HomeSuggestion[]): number {
  return new Set(pool.map((item) => item.id)).size;
}

function getTimeBucket(date: Date): TimeBucket {
  const h = date.getHours();
  if (h >= 5 && h < 8) return 'early';
  if (h >= 8 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'late';
}

async function getRecent(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function pushRecent(ids: string[]): Promise<void> {
  try {
    const recent = await getRecent();
    const next = [...ids, ...recent.filter((id) => !ids.includes(id))].slice(0, RECENT_MEMORY);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Suggestions should keep rendering even if storage is unavailable.
  }
}
