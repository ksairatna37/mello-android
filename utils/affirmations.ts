/**
 * Daily affirmation — fetched from the free public API at affirmations.dev
 * (HTTPS, no auth, `{ affirmation: string }`). Cached locally for 24 hours so
 * every user sees the same line all day, and falls back to a curated local
 * list when the network is unreachable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const AFFIRMATION_ENDPOINT = 'https://www.affirmations.dev/';
const CACHE_KEY = '@mello/daily_affirmation';
const FETCH_TIMEOUT_MS = 6000;

const FALLBACK_QUOTES = [
  "You showed up today. That's the hardest part. Everything else is just the next step.",
  'Notice one thing that feels lighter than yesterday.',
  'You do not need to solve everything today, just stay with yourself kindly.',
  'A small check-in still counts as care.',
  'Your feelings are data, not directions. You get to choose what comes next.',
];

interface CachedAffirmation {
  quote: string;
  dateKey: string;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localFallback(): string {
  const idx = new Date().getDate() % FALLBACK_QUOTES.length;
  return FALLBACK_QUOTES[idx];
}

async function readCache(): Promise<CachedAffirmation | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedAffirmation;
  } catch {
    return null;
  }
}

async function writeCache(value: CachedAffirmation): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Ignore cache write failures — the quote is still usable this session.
  }
}

async function fetchRemote(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const started = Date.now();
  console.log('[affirmations] → GET', AFFIRMATION_ENDPOINT);
  try {
    const res = await fetch(AFFIRMATION_ENDPOINT, { signal: controller.signal });
    const ms = Date.now() - started;
    if (!res.ok) {
      console.warn(`[affirmations] ← ${res.status} (${ms}ms)`);
      return null;
    }
    const json = (await res.json()) as { affirmation?: unknown };
    const quote = typeof json?.affirmation === 'string' ? json.affirmation.trim() : '';
    if (!quote) {
      console.warn(`[affirmations] ← empty payload (${ms}ms)`);
      return null;
    }
    console.log(`[affirmations] ← 200 (${ms}ms) "${quote.slice(0, 60)}${quote.length > 60 ? '…' : ''}"`);
    return quote;
  } catch (err: any) {
    const ms = Date.now() - started;
    console.warn(`[affirmations] ✕ (${ms}ms) ${err?.name ?? 'Error'}: ${err?.message ?? err}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns today's affirmation. Fetches from the API once per calendar day,
 * then serves from cache. Never throws — always returns *something*.
 */
export async function getDailyAffirmation(): Promise<string> {
  const today = todayKey();

  const cached = await readCache();
  if (cached && cached.dateKey === today && cached.quote) {
    return cached.quote;
  }

  const remote = await fetchRemote();
  if (remote) {
    await writeCache({ quote: remote, dateKey: today });
    return remote;
  }

  // Network failure — prefer yesterday's cached quote over the static fallback
  // so the user doesn't see the same dev-picked line every offline day.
  if (cached?.quote) return cached.quote;
  return localFallback();
}

/**
 * Bypasses the 24h cache and fetches a fresh affirmation. Used by the refresh
 * button on the affirmation card. The fresh quote is written back to cache so
 * it becomes the line of the day.
 */
export async function refreshAffirmation(): Promise<string> {
  const remote = await fetchRemote();
  if (remote) {
    await writeCache({ quote: remote, dateKey: todayKey() });
    return remote;
  }
  const cached = await readCache();
  if (cached?.quote) return cached.quote;
  return localFallback();
}
