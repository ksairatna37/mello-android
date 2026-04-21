import type { OnboardingData } from '@/utils/onboardingStorage';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface Option {
  id: string;
  icon: string;
  label: string;
  description: string;
}

export interface Question {
  id: string;
  title: string;
  subtitle: string;
  storageKey?: keyof OnboardingData;
  options: Option[];
  type?: 'options' | 'battery' | 'fact' | 'leaf';
  multiSelect?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TOTAL_QUESTIONS = 10;

// ─── Questions Data ───────────────────────────────────────────────────────────

export const QUESTIONS: Question[] = [
  {
    id: 'mood_weather',
    storageKey: 'moodWeather',
    title: "What's the weather inside your head right now?",
    subtitle: "Tap the one that feels right.",
    options: [
      { id: 'stormy', icon: '⛈️', label: 'Stormy', description: 'Everything feels like too much' },
      { id: 'rainy', icon: '🌧️', label: 'Rainy', description: 'Heavy and slow today' },
      { id: 'foggy', icon: '🌫️', label: 'Foggy', description: "Can't think straight" },
      { id: 'cloudy', icon: '⛅', label: 'Cloudy', description: 'Up and down, hard to tell' },
      { id: 'okay', icon: '☀️', label: 'Surprisingly Okay', description: "Don't know why I'm here tbh" },
    ],
  },
  {
    id: 'spirit_animal',
    storageKey: 'spiritAnimal',
    title: "When you're struggling, you're most like...",
    subtitle: "Pick your spirit animal.",
    options: [
      { id: 'turtle', icon: '🐢', label: 'The Turtle', description: 'I go quiet and process alone' },
      { id: 'butterfly', icon: '🦋', label: 'The Butterfly', description: 'I need to talk it out' },
      { id: 'wolf', icon: '🐺', label: 'The Wolf', description: 'I need my people around me' },
      { id: 'lion', icon: '🦁', label: 'The Lion', description: 'Just tell me what to do' },
      { id: 'shell', icon: '🐚', label: 'The Shell', description: 'I shut down first, then slowly open up' },
    ],
  },
  {
    id: 'late_night_mood',
    storageKey: 'lateNightMood',
    title: "It's 2am. You can't sleep. What's actually going on?",
    subtitle: "Tap the one that fits.",
    options: [
      { id: 'loop', icon: '🔄', label: 'The Loop', description: "Same thoughts. Over and over. Won't stop." },
      { id: 'ache', icon: '💔', label: 'The Ache', description: "Something hurts but I can't explain what." },
      { id: 'replay', icon: '⏮️', label: 'The Replay', description: "Going over a conversation I can't undo." },
      { id: 'overwhelm', icon: '🌊', label: 'The Overwhelm', description: "Everything at once. Don't know where to start." },
      { id: 'void', icon: '🕳️', label: 'The Void', description: 'Nothing. Just... empty. And that feels worse.' },
      { id: 'wander', icon: '🌙', label: 'The Wander', description: "I'm fine, I just stumbled here." },
    ],
  },
  {
    id: 'text_to_self',
    storageKey: 'textToSelf',
    title: "If you could text yourself from 6 months ago...",
    subtitle: "Tap to finish the sentence 💬",
    options: [
      { id: 'okay', icon: '💙', label: '"Hey. You\'re going to be okay. Just—"', description: '' },
      { id: 'alone', icon: '🤝', label: '"Stop carrying everything alone."', description: '' },
      { id: 'figured', icon: '🤷', label: '"It\'s okay that you don\'t have it figured out."', description: '' },
      { id: 'grown', icon: '🌱', label: '"You\'ve grown more than you know."', description: '' },
      { id: 'avoiding', icon: '⏰', label: '"The thing you\'re avoiding? It\'s time."', description: '' },
    ],
  },
  {
    id: 'emotional_battery',
    storageKey: 'emotionalBattery',
    title: 'How full is your emotional battery right now?',
    subtitle: "Take a moment to tune in.",
    type: 'battery',
    options: [],
  },
  {
    id: 'did_you_know',
    title: '',
    subtitle: '',
    type: 'fact',
    options: [],
  },
  {
    id: 'weakest_dimension',
    storageKey: 'weakestDimension',
    title: "On a tough day, what goes first?",
    subtitle: "Pick the one that hits closest.",
    options: [
      { id: 'calm', icon: '🌊', label: 'My patience', description: "I get overwhelmed and can't settle down" },
      { id: 'clarity', icon: '🌫️', label: 'My thinking', description: "My head goes foggy and I can't think straight" },
      { id: 'focus', icon: '🎯', label: 'My drive', description: "I lose interest in everything I was doing" },
      { id: 'confidence', icon: '😰', label: 'My nerve', description: 'I start doubting every decision I make' },
      { id: 'positivity', icon: '☁️', label: 'My mood', description: "Everything just feels heavier than it should" },
    ],
  },
  {
    id: 'age_range',
    storageKey: 'ageRange',
    title: 'How old are you?',
    subtitle: 'Pick your age range.',
    options: [
      { id: 'under-18', icon: '✨', label: '17 or younger', description: '' },
      { id: '18-24', icon: '🚀', label: '18 to 24', description: '' },
      { id: '25-34', icon: '📈', label: '25 to 34', description: '' },
      { id: '35-44', icon: '🧭', label: '35 to 44', description: '' },
      { id: '45-54', icon: '🍃', label: '45 to 54', description: '' },
      { id: '55+', icon: '⭐', label: '55 or older', description: '' },
    ],
  },
  {
    id: 'gender',
    storageKey: 'gender',
    title: 'How would you describe your gender?',
    subtitle: 'This helps us personalise your experience.',
    options: [
      { id: 'male', icon: '👨', label: 'Male', description: '' },
      { id: 'female', icon: '👩', label: 'Female', description: '' },
      { id: 'other', icon: '🌈', label: 'Other', description: '' },
    ],
  },
  {
    id: 'emotional_growth',
    storageKey: 'emotionalGrowth',
    title: 'Where are you in your emotional growth?',
    subtitle: 'Tap the one that feels most true right now.',
    type: 'leaf',
    options: [],
  },
  {
    id: 'support_style',
    storageKey: 'supportStyle',
    title: "What kind of support feels right?",
    subtitle: "We'll shape your experience around this.",
    options: [
      { id: 'listen', icon: '👂', label: 'Just listen, no advice', description: "I need to be heard first" },
      { id: 'understand', icon: '🔍', label: 'Help me understand myself', description: "I want to make sense of what I feel" },
      { id: 'tools', icon: '🛠️', label: 'Give me tools to cope', description: "Practical stuff I can actually use" },
      { id: 'checkin', icon: '📅', label: 'Check in with me regularly', description: "Consistency keeps me grounded" },
      { id: 'unsure', icon: '🗺️', label: "I'm not sure yet", description: "Help me figure that out too" },
    ],
  },
];
