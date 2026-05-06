/**
 * Onboarding questions — verbatim port of Claude Design mockups in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding-q.jsx
 *
 * 10 questions total, split 5 + [Did you know] + 5.
 * Single-select with auto-scroll-on-tap (no Continue button).
 * Q5  → BatterySlider  (retained from previous flow)
 * Q9  → LeafGrowth     (retained from previous flow)
 * Q10 → freeform text
 */

import type { OnboardingData } from '@/utils/onboardingStorage';

/* ─── Shared types ───────────────────────────────────────────────────── */

/** A title chunk. Plain string → upright; `{i}` → italic. */
export type TitleSegment = string | { i: string };

export type ToneKey = 'peach' | 'lavender' | 'sage' | 'butter' | 'coral';

export type QuestionType = 'options' | 'battery' | 'leaf' | 'fact' | 'freeform';

export interface QuestionOption {
  /** Stable id persisted in storage. */
  id: string;
  /** Emoji shown before the main label. */
  icon: string;
  /** Main label (design calls it `t`). */
  t: string;
  /** Optional italic subtitle below the label. */
  sub?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  tone: ToneKey;
  kicker: string;
  /** Title as an array of upright strings / `{i}` italic chunks. */
  title: TitleSegment[];
  /** Lede paragraph shown under the title. */
  subtitle: string;
  /** Option list (for `type === 'options'`). */
  options?: QuestionOption[];
  /** Persisted key on OnboardingData. */
  storageKey?: keyof OnboardingData;
  /** Placeholder for freeform. */
  placeholder?: string;
}

export const TOTAL_QUESTIONS = 10;

/* ─── Questions ─────────────────────────────────────────────────────── */

export const QUESTIONS: (Question | { id: string; type: 'fact' })[] = [
  // Q1
  {
    id: 'head_weather',
    type: 'options',
    tone: 'peach',
    kicker: 'no wrong answer',
    title: ['What’s the weather inside your ', { i: 'head' }, ' right now?'],
    subtitle: 'Pick the one that feels closest. You can change later.',
    storageKey: 'qHeadWeather' as keyof OnboardingData,
    options: [
      { id: 'stormy',  icon: '⛈️', t: 'Stormy',             sub: 'everything feels like too much' },
      { id: 'rainy',   icon: '🌧️', t: 'Rainy',              sub: 'heavy and slow' },
      { id: 'foggy',   icon: '🌫️', t: 'Foggy',              sub: 'can’t think straight' },
      { id: 'cloudy',  icon: '⛅',  t: 'Cloudy',             sub: 'up and down today' },
      { id: 'okay',    icon: '☀️', t: 'Surprisingly okay',  sub: 'don’t know why I’m here tbh' },
    ],
  },

  // Q2
  {
    id: 'hardest_time',
    type: 'options',
    tone: 'lavender',
    kicker: 'the shape of the day',
    title: ['When is it ', { i: 'hardest' }, '?'],
    subtitle: 'If many are true, pick the loudest one.',
    storageKey: 'qHardestTime' as keyof OnboardingData,
    options: [
      { id: 'sunday',    icon: '🌤️', t: 'Sunday late afternoon', sub: 'the anticipatory tax' },
      { id: 'afternoon', icon: '🪫', t: 'The 2–4pm slump',       sub: 'afternoon energy cliff' },
      { id: 'post-work', icon: '🚪', t: 'Right after work',      sub: 'the re-entry hour' },
      { id: 'late',      icon: '🌙', t: 'Late at night',         sub: 'when the quiet gets loud' },
      { id: 'morning',   icon: '☕', t: 'Honestly, mornings',    sub: 'bracing before the day' },
    ],
  },

  // Q3
  {
    id: 'coping_animal',
    type: 'options',
    tone: 'sage',
    kicker: 'how you move through it',
    title: ['When you’re going through something, which is ', { i: 'more you' }, '?'],
    subtitle: 'Pick the one that feels most like your default.',
    storageKey: 'qCopingAnimal' as keyof OnboardingData,
    options: [
      { id: 'turtle',    icon: '🐢', t: 'The Turtle',    sub: 'I retreat and process quietly alone' },
      { id: 'butterfly', icon: '🦋', t: 'The Butterfly', sub: 'I need to talk it out to make sense of it' },
      { id: 'wolf',      icon: '🐺', t: 'The Wolf',      sub: 'I need my pack — connection heals me' },
      { id: 'lion',      icon: '🦁', t: 'The Lion',      sub: 'tell me what to do, I’ll fix it' },
      { id: 'shell',     icon: '🐚', t: 'The Shell',     sub: 'I shut down completely first' },
    ],
  },

  // Q4
  {
    id: 'stress_response',
    type: 'options',
    tone: 'butter',
    kicker: 'when something stressful happens',
    title: ['When stress hits, ', { i: 'what happens' }, '?'],
    subtitle: 'No right answer — just the most familiar pattern.',
    storageKey: 'qStressResponse' as keyof OnboardingData,
    options: [
      { id: 'calm',          icon: '🌊', t: 'I stay calm and think clearly' },
      { id: 'overwhelmed',   icon: '🌪️', t: 'I feel overwhelmed quickly' },
      { id: 'distract',      icon: '🎧', t: 'I try to distract myself' },
      { id: 'react-recover', icon: '🌤️', t: 'I react strongly at first but calm down later' },
    ],
  },

  // Q5 — BatterySlider (retained from previous flow)
  {
    id: 'emotional_battery',
    type: 'battery',
    tone: 'coral',
    kicker: 'a calibration',
    title: ['How full is your ', { i: 'emotional battery' }, '?'],
    subtitle: 'Take a moment to tune in. Drag to feel your way there.',
    storageKey: 'emotionalBattery',
  },

  // [Did you know interstitial]
  { id: 'did_you_know', type: 'fact' },

  // Q6
  {
    id: 'support_style',
    type: 'options',
    tone: 'peach',
    kicker: 'when someone needs you',
    title: ['When someone shares their problems with you, ', { i: 'you' }, '…'],
    subtitle: 'A read on how you show up for others.',
    storageKey: 'qSupportStyle' as keyof OnboardingData,
    options: [
      { id: 'listener', icon: '👂', t: 'I listen and support them' },
      { id: 'empath',   icon: '💙', t: 'I feel their emotions deeply' },
      { id: 'advisor',  icon: '🛠️', t: 'I try to give practical advice' },
      { id: 'unsure',   icon: '🗺️', t: 'I feel unsure what to say' },
    ],
  },

  // Q7
  {
    id: 'sadness_response',
    type: 'options',
    tone: 'lavender',
    kicker: 'when sadness shows up',
    title: ['When you ', { i: 'feel sad' }, '…'],
    subtitle: 'Just where you usually land — no wrong answer.',
    storageKey: 'qSadnessResponse' as keyof OnboardingData,
    options: [
      { id: 'talk',     icon: '💬', t: 'I talk to someone about it' },
      { id: 'immerse',  icon: '💔', t: 'I feel it very deeply' },
      { id: 'private',  icon: '🤫', t: 'I keep it to myself' },
      { id: 'fleeting', icon: '🍃', t: 'It passes quickly' },
    ],
  },

  // Q8 — user asked for no multi-select → changed to single (pick most relevant)
  {
    id: 'tried_things',
    type: 'options',
    tone: 'sage',
    kicker: 'what you’ve tried',
    title: ['What have you ', { i: 'tried' }, ' before?'],
    subtitle: 'So I don’t suggest what hasn’t worked. Pick the most recent.',
    storageKey: 'qTriedThings' as keyof OnboardingData,
    options: [
      { id: 'therapy-now',    icon: '🛋️', t: 'Therapy — currently' },
      { id: 'therapy-past',   icon: '🕰️', t: 'Therapy — in the past' },
      { id: 'medication',     icon: '💊', t: 'Medication' },
      { id: 'meditation',     icon: '🧘', t: 'Meditation / breathwork apps' },
      { id: 'journaling',     icon: '📓', t: 'Journaling on my own' },
      { id: 'first-time',     icon: '✨', t: 'This is my first time trying something' },
    ],
  },

  // Q9 — LeafGrowth (retained from previous flow)
  {
    id: 'emotional_growth',
    type: 'leaf',
    tone: 'butter',
    kicker: 'the rhythm of growth',
    title: ['Where are you in your ', { i: 'growth' }, '?'],
    subtitle: 'No wrong spot — just where you are today.',
    storageKey: 'emotionalGrowth',
  },

  // Q10 — freeform
  {
    id: 'make_it_work',
    type: 'freeform',
    tone: 'coral',
    kicker: 'one last thing',
    title: ['What would make this ', { i: 'actually work' }, ' for you?'],
    subtitle: 'Open field. Or skip — I’ll learn as we go.',
    storageKey: 'qMakeItWork' as keyof OnboardingData,
    placeholder: 'I think I’d keep coming back if…',
  },
];
