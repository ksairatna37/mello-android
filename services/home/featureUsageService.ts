import AsyncStorage from '@react-native-async-storage/async-storage';

export type FeatureUseId =
  | 'chat'
  | 'voice'
  | 'journal'
  | 'saved-chat'
  | 'mood'
  | 'weekly'
  | 'progress'
  | 'box-breath'
  | 'grounding'
  | 'brain-dump'
  | 'reach-out'
  | 'sound-space'
  | 'practice';

export interface FeatureUseEvent {
  id: string;
  feature: FeatureUseId;
  label: string;
  route?: string;
  createdAt: string;
}

const STORE_KEY = 'selfmind:featureUsage:v1';
const MAX_EVENTS = 500;

const LABELS: Record<FeatureUseId, string> = {
  chat: 'chat',
  voice: 'voice',
  journal: 'journal',
  'saved-chat': 'saved chat',
  mood: 'mood',
  weekly: 'weekly',
  progress: 'progress',
  'box-breath': 'box breath',
  grounding: 'grounding',
  'brain-dump': 'brain dump',
  'reach-out': 'reach out',
  'sound-space': 'sound space',
  practice: 'practice',
};

const ROUTE_FEATURES: Array<{ pattern: RegExp; feature: FeatureUseId }> = [
  { pattern: /^\/chat\b|^\/chats\b/, feature: 'chat' },
  { pattern: /^\/call\b|^\/voice-active\b/, feature: 'voice' },
  { pattern: /^\/journal\b|^\/journal-prompt\b|^\/journal-entry\b/, feature: 'journal' },
  { pattern: /^\/mood\b|^\/mood-history\b|^\/mood-detail\b/, feature: 'mood' },
  { pattern: /^\/weekly\b/, feature: 'weekly' },
  { pattern: /^\/box-breath\b/, feature: 'box-breath' },
  { pattern: /^\/grounding\b/, feature: 'grounding' },
  { pattern: /^\/brain-dump\b/, feature: 'brain-dump' },
  { pattern: /^\/reach-out\b/, feature: 'reach-out' },
  { pattern: /^\/space\b|^\/spaces\b/, feature: 'sound-space' },
  { pattern: /^\/practice\b/, feature: 'practice' },
];

export async function recordFeatureUse(args: {
  feature: FeatureUseId;
  route?: string;
  label?: string;
  now?: Date;
}): Promise<void> {
  const now = args.now ?? new Date();
  const event: FeatureUseEvent = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    feature: args.feature,
    label: args.label ?? LABELS[args.feature],
    route: args.route,
    createdAt: now.toISOString(),
  };

  try {
    const current = await listFeatureUses();
    await AsyncStorage.setItem(
      STORE_KEY,
      JSON.stringify([event, ...current].slice(0, MAX_EVENTS)),
    );
  } catch {
    // Usage hints should never block navigation.
  }
}

export async function recordRouteUse(route: string, now?: Date): Promise<void> {
  const match = ROUTE_FEATURES.find((item) => item.pattern.test(route));
  if (!match) return;
  await recordFeatureUse({ feature: match.feature, route, now });
}

export async function listFeatureUses(): Promise<FeatureUseEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFeatureUseEvent) : [];
  } catch {
    return [];
  }
}

export async function listFeatureUsesBetween(start: Date, end: Date): Promise<FeatureUseEvent[]> {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return (await listFeatureUses()).filter((event) => {
    const ms = new Date(event.createdAt).getTime();
    return ms >= startMs && ms <= endMs;
  });
}

function isFeatureUseEvent(value: unknown): value is FeatureUseEvent {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FeatureUseEvent>;
  return (
    typeof item.id === 'string' &&
    typeof item.feature === 'string' &&
    typeof item.label === 'string' &&
    typeof item.createdAt === 'string'
  );
}
