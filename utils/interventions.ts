/**
 * Intervention Detection System
 * Ported from mello-webapp-demo for React Native
 *
 * Detects emotional states requiring specialized guidance:
 * - suicidal_tendencies (priority 110)
 * - crisis (priority 100)
 * - breathing/panic (priority 80)
 * - trauma (priority 70)
 * - work_exhaustion (priority 60)
 * - loneliness (priority 50)
 * - emotional_processing (priority 40)
 */

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type InterventionType =
  | 'suicidal_tendencies'
  | 'crisis'
  | 'breathing'
  | 'work_exhaustion'
  | 'loneliness'
  | 'trauma'
  | 'emotional_processing';

export type InterventionDecision = {
  type: InterventionType;
  guidance: string;
  ttlMs: number;
  priority: number;
  cooldownMs: number;
};

export type InterventionDetectorState = {
  lastDecisionType: InterventionType | null;
  lastDecisionAt: number | null;
  history: Array<{
    type: InterventionType;
    timestamp: number;
  }>;
};

type EmotionScores = Record<string, number>;

type HumeMessageLike = {
  type?: string;
  message?: {
    content?: string | null;
  } | null;
  models?: unknown;
};

type InterventionInput = {
  transcript: string;
  emotions: EmotionScores;
};

type InterventionRule = InterventionDecision & {
  matches: (input: InterventionInput) => boolean;
};

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const DEFAULT_TTL_MS = 120_000;
const DEFAULT_COOLDOWN_MS = 90_000;
const MIN_TRANSCRIPT_LENGTH = 15;

// ═══════════════════════════════════════════════════
// DETECTION PATTERNS
// ═══════════════════════════════════════════════════

const CRISIS_REGEX =
  /\b(end it all|can't do this anymore|cannot do this anymore|done with life|want this to stop|don't want to be here|do not want to be here|can't go on|cannot go on|no point anymore)\b/i;

const SUICIDAL_REGEX =
  /\b(suicide|suicidal|kill myself|end my life|want to die|don't want to live|do not want to live|hurt myself|harm myself|better off dead|wish i were dead)\b/i;

const PANIC_REGEX =
  /\b(panic(?:king|ked)?|panic attack|anxious|anxiety attack|overwhelm(?:ed|ing)?|can'?t breathe|cannot breathe|hard(?:er)? to breathe|freaking out|chest (?:is )?tight|heart (?:is )?racing|spiral(?:ing|ed)?)\b/i;

const WORK_EXHAUSTION_REGEX =
  /\b(work(?:ing)? all (?:the )?time|can'?t stop work(?:ing)?|cannot stop work(?:ing)?|always work(?:ing)?|burn(?:ed|t)? out|burnout|exhausted (?:from|by) work|work (?:is )?everything|work (?:like )?\d+ hours?|work eighty hours|eighty hours a week|keep pushing myself|can'?t (?:seem to )?stop|even on weekends|never stop work(?:ing)?|always on (?:the )?clock|work all weekend|i (?:just )?keep work(?:ing)?|i only work)\b/i;

const LONELINESS_REGEX =
  /\b(lonely|(?:all )?alone|isolated|nobody understands(?: me)?|no (?:real )?friends|feel(?:ing)? disconnected|feel(?:ing)? left out|no one gets me|i have nobody|no one to talk to|i'?m (?:so )?alone|nobody cares)\b/i;

const TRAUMA_REGEX =
  /\b(trauma|abuse|assault|attacked|harassed|molested|violated|flashback|ptsd|what happened to me|unsafe after|after what happened)\b/i;

const EMOTIONAL_PROCESSING_REGEX =
  /\b(i don't know what i'm feeling|i dont know what i'm feeling|i can't understand my feelings|i cant understand my feelings|i feel numb|i'm numb|im numb|confused about how i feel|trying to understand my feelings|what am i feeling|why do i feel this way|mixed feelings|all over the place emotionally)\b/i;

// ═══════════════════════════════════════════════════
// INTERVENTION RULES
// ═══════════════════════════════════════════════════

const INTERVENTION_RULES: InterventionRule[] = [
  {
    type: 'suicidal_tendencies',
    guidance:
      'User may have suicidal thoughts or self-harm intent. Respond with calm, direct empathy and prioritize immediate safety. Ask if they are in immediate danger or thinking of acting on it now. Strongly encourage contacting a trusted person, emergency help, or a crisis line right away. Offer one concrete next step like calling someone now, moving away from anything dangerous, unlocking the door, or staying connected while they reach out. Do not stay abstract or overly exploratory.',
    ttlMs: 180_000,
    priority: 110,
    cooldownMs: 15_000,
    matches: ({ transcript, emotions }) =>
      SUICIDAL_REGEX.test(transcript) ||
      (/\b(want to disappear|wish i could disappear|better without me|should not be here)\b/i.test(transcript) &&
        hasEmotion(emotions, ['sadness', 'distress', 'pain'], 0.4)),
  },
  {
    type: 'crisis',
    guidance:
      'User may be in crisis. Respond with calm empathy and prioritize immediate safety over exploration. Ask if they are in immediate danger and encourage urgent human support now: a trusted person, local emergency help, or a crisis line. Offer one tiny next step like putting distance between them and anything dangerous, calling someone now, or staying on the line while they reach out. Keep it brief and direct.',
    ttlMs: 180_000,
    priority: 100,
    cooldownMs: 15_000,
    matches: ({ transcript, emotions }) =>
      CRISIS_REGEX.test(transcript) ||
      (/\b(goodbye)\b/i.test(transcript) &&
        hasEmotion(emotions, ['distress', 'sadness', 'pain', 'fear'], 0.35)),
  },
  {
    type: 'breathing',
    guidance:
      'When panic, anxiety, or overwhelm is high, first validate briefly, then ask consent for one short grounding technique. Prefer box breathing with a slow count, and if the user says breathing feels hard, offer butterfly hug tapping or the five four three two one grounding exercise instead. After the technique, ask what changed in their body by even five percent. Keep it calm, practical, and solution focused.',
    ttlMs: DEFAULT_TTL_MS,
    priority: 80,
    cooldownMs: DEFAULT_COOLDOWN_MS,
    matches: ({ transcript, emotions }) =>
      hasEmotion(emotions, ['anxiety', 'distress', 'fear', 'stress', 'horror'], 0.5) ||
      PANIC_REGEX.test(transcript),
  },
  {
    type: 'work_exhaustion',
    guidance:
      'When the user sounds trapped in overwork, validate the exhaustion and help them notice the pattern between pressure, fear, and constant work. Ask one curious question about what feels risky about resting. Offer one small experiment, such as a ten minute pause, stopping one task tonight, or protecting one hour this weekend. Keep it concrete, supportive, and nonjudgmental.',
    ttlMs: DEFAULT_TTL_MS,
    priority: 60,
    cooldownMs: DEFAULT_COOLDOWN_MS,
    matches: ({ transcript, emotions }) =>
      WORK_EXHAUSTION_REGEX.test(transcript) &&
      hasEmotionCombination(
        emotions,
        [
          { emotions: ['tiredness', 'fatigue'], threshold: 0.2 },
          { emotions: ['stress', 'anxiety', 'distress', 'disappointment'], threshold: 0.2 },
        ],
        true,
      ),
  },
  {
    type: 'loneliness',
    guidance:
      'When the user expresses loneliness or isolation, validate the ache of being alone and help them identify where connection has felt even slightly safer before. Ask about one person, place, or routine that makes them feel five percent less alone. Offer one tiny step like sending one text, sitting near people, or making one plan for today. Keep it warm and practical.',
    ttlMs: DEFAULT_TTL_MS,
    priority: 50,
    cooldownMs: DEFAULT_COOLDOWN_MS,
    matches: ({ transcript, emotions }) =>
      LONELINESS_REGEX.test(transcript) && hasEmotion(emotions, ['sadness', 'distress', 'pain'], 0.35),
  },
  {
    type: 'trauma',
    guidance:
      'When the user shares trauma, abuse, or feeling unsafe after something major, validate the weight of it without pushing for details. Focus on present safety and stabilization. Offer one grounding option like feet on the floor, looking around the room, or butterfly hug tapping. Ask what would help them feel even five percent safer right now, and gently encourage reaching out to a trusted person if appropriate.',
    ttlMs: DEFAULT_TTL_MS,
    priority: 70,
    cooldownMs: DEFAULT_COOLDOWN_MS,
    matches: ({ transcript, emotions }) =>
      TRAUMA_REGEX.test(transcript) && hasEmotion(emotions, ['distress', 'fear', 'sadness', 'pain'], 0.3),
  },
  {
    type: 'emotional_processing',
    guidance:
      'When the user is trying to understand their feelings or feels numb or confused, help them label the experience gently. Ask about three anchors: what happened, what they feel in the body, and what emotion word fits best even if it is only a guess. If useful, offer simple options like sad, angry, scared, guilty, lonely, or numb. Then ask what the feeling may be needing right now.',
    ttlMs: DEFAULT_TTL_MS,
    priority: 40,
    cooldownMs: DEFAULT_COOLDOWN_MS,
    matches: ({ transcript, emotions }) =>
      EMOTIONAL_PROCESSING_REGEX.test(transcript) ||
      (hasEmotion(emotions, ['confusion', 'contemplation', 'doubt', 'sadness'], 0.3) &&
        /\b(feel|feeling|understand|why|what)\b/i.test(transcript)),
  },
];

// ═══════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function hasEmotion(emotions: EmotionScores, emotionNames: string[], threshold: number): boolean {
  return emotionNames.some((emotionName) => {
    const exact = emotions[normalizeKey(emotionName)];
    if (typeof exact === 'number' && exact >= threshold) {
      return true;
    }
    return Object.entries(emotions).some(
      ([key, value]) => key.includes(normalizeKey(emotionName)) && value >= threshold,
    );
  });
}

function hasEmotionCombination(
  emotions: EmotionScores,
  combinations: Array<{ emotions: string[]; threshold: number }>,
  requireAll = false,
): boolean {
  const matches = combinations.map(({ emotions: emotionNames, threshold }) =>
    hasEmotion(emotions, emotionNames, threshold),
  );
  return requireAll ? matches.every(Boolean) : matches.some(Boolean);
}

function looksLikeEmotionRecord(record: Record<string, unknown>): boolean {
  const numericEntries = Object.entries(record).filter(([, value]) => typeof value === 'number');
  if (numericEntries.length === 0) {
    return false;
  }
  return numericEntries.some(([key]) =>
    ['anxiety', 'distress', 'sadness', 'fear', 'stress', 'tired', 'fatigue'].some((emotion) =>
      normalizeKey(key).includes(emotion),
    ),
  );
}

function findEmotionRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const directScores = [candidate.scores, candidate.emotions, candidate.prosody, candidate.language];

  for (const direct of directScores) {
    if (direct && typeof direct === 'object') {
      const nested = direct as Record<string, unknown>;
      if (looksLikeEmotionRecord(nested)) {
        return nested;
      }

      const nestedScores = nested.scores;
      if (
        nestedScores &&
        typeof nestedScores === 'object' &&
        looksLikeEmotionRecord(nestedScores as Record<string, unknown>)
      ) {
        return nestedScores as Record<string, unknown>;
      }
    }
  }

  for (const nestedValue of Object.values(candidate)) {
    const found = findEmotionRecord(nestedValue);
    if (found) {
      return found;
    }
  }

  return null;
}

function extractEmotionScores(models: unknown): EmotionScores {
  const rawScores = findEmotionRecord(models);
  if (!rawScores) {
    return {};
  }

  const normalized: EmotionScores = {};

  for (const [key, value] of Object.entries(rawScores)) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      continue;
    }
    if (value < 0.05) {
      continue;
    }
    normalized[normalizeKey(key)] = value;
  }

  return normalized;
}

// ═══════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════

export function getInitialInterventionDetectorState(): InterventionDetectorState {
  return {
    lastDecisionType: null,
    lastDecisionAt: null,
    history: [],
  };
}

export function detectIntervention(
  message: HumeMessageLike,
  state: InterventionDetectorState,
  now = Date.now(),
): InterventionDecision | null {
  if (message.type !== 'user_message') {
    return null;
  }

  const transcript = message.message?.content?.trim() ?? '';
  if (!transcript) {
    return null;
  }

  // Short transcripts skip detection unless crisis/suicidal keywords present
  if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
    const isPotentialCrisis = SUICIDAL_REGEX.test(transcript) || CRISIS_REGEX.test(transcript);
    if (!isPotentialCrisis) {
      return null;
    }
  }

  const input: InterventionInput = {
    transcript,
    emotions: extractEmotionScores(message.models),
  };

  for (const rule of INTERVENTION_RULES) {
    if (!rule.matches(input)) {
      continue;
    }

    // Check cooldown
    if (
      state.lastDecisionType === rule.type &&
      state.lastDecisionAt &&
      now - state.lastDecisionAt < rule.cooldownMs
    ) {
      return null;
    }

    // Update history
    state.history.push({
      type: rule.type,
      timestamp: now,
    });
    state.history = state.history.filter((entry) => now - entry.timestamp < 600_000);

    return {
      type: rule.type,
      guidance: rule.guidance,
      ttlMs: rule.ttlMs,
      priority: rule.priority,
      cooldownMs: rule.cooldownMs,
    };
  }

  return null;
}

/**
 * Check if intervention type requires auto-expanded crisis resources
 */
export function isHighPriorityIntervention(type: InterventionType): boolean {
  return type === 'suicidal_tendencies' || type === 'crisis';
}
