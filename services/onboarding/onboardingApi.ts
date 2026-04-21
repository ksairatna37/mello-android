/**
 * Onboarding API Service
 * Handles syncing onboarding data to backend
 */

import { authPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getOnboardingData, type OnboardingData } from '@/utils/onboardingStorage';
import { getAccessToken, getSession } from '@/services/auth';

// ─── Answer label maps (mirrors questions.tsx) ───────────────────────────────

const MOOD_WEATHER_MAP: Record<string, string> = {
  stormy: 'Stormy — everything feels like too much',
  rainy:  'Rainy — heavy and slow',
  foggy:  "Foggy — can't think straight",
  cloudy: 'Cloudy — up and down',
  okay:   'Surprisingly okay',
};
const SPIRIT_ANIMAL_MAP: Record<string, string> = {
  turtle:    'The Turtle — I go quiet and process alone',
  butterfly: 'The Butterfly — I need to talk it out',
  wolf:      'The Wolf — I need my people around me',
  lion:      'The Lion — just tell me what to do',
  shell:     'The Shell — I shut down first, then slowly open up',
};
const LATE_NIGHT_MAP: Record<string, string> = {
  loop:      'The Loop — same thoughts over and over',
  ache:      "The Ache — something hurts but I can't explain what",
  replay:    "The Replay — going over a conversation I can't undo",
  overwhelm: 'The Overwhelm — everything at once',
  void:      'The Void — nothing, just empty',
  wander:    "The Wander — I'm fine, I just stumbled here",
};
const TEXT_TO_SELF_MAP: Record<string, string> = {
  okay:     '"Hey, you\'re going to be okay"',
  alone:    '"Stop carrying everything alone"',
  figured:  '"It\'s okay that you don\'t have it figured out"',
  grown:    '"You\'ve grown more than you know"',
  avoiding: '"The thing you\'re avoiding — it\'s time"',
};
const WEAKEST_DIMENSION_MAP: Record<string, string> = {
  calm:       "My patience — I get overwhelmed and can't settle down",
  clarity:    "My thinking — my head goes foggy and I can't think straight",
  focus:      'My drive — I lose interest in everything I was doing',
  confidence: 'My nerve — I start doubting every decision I make',
  positivity: "My mood — everything feels heavier than it should",
};
const AGE_RANGE_MAP: Record<string, string> = {
  'under-18': '17 or younger',
  '18-24':    '18 to 24',
  '25-34':    '25 to 34',
  '35-44':    '35 to 44',
  '45-54':    '45 to 54',
  '55+':      '55 or older',
};
const GENDER_MAP: Record<string, string> = {
  male:   'Male',
  female: 'Female',
  other:  'Other',
};
const MATURITY_MAP: Record<string, string> = {
  responsibility:         'Taking responsibility for actions',
  self_reflection:        'Frequently doing emotional work and self-reflecting',
  conflict_resolution:    'Resolving conflicts instead of ignoring them',
  accepting_reality:      'Accepting reality, not denying it',
  learning_from_mistakes: 'Learning from past mistakes',
  emotion_regulation:     'Regulating emotions rather than acting on them',
  empathy:                "Empathy and care for others' wellbeing",
};
const SUPPORT_MAP: Record<string, string> = {
  listen:    'Just listen, no advice — I need to be heard first',
  understand: 'Help me understand myself',
  tools:     'Give me practical tools to cope',
  checkin:   'Check in with me regularly',
  unsure:    "I'm not sure yet — help me figure that out",
};

// ─── Build onboarding_user_preferences JSON ──────────────────────────────────

function buildPreferences(data: OnboardingData): Record<string, string> {
  const prefs: Record<string, string> = {};

  if (data.moodWeather)
    prefs["What's the weather inside your head right now?"] =
      MOOD_WEATHER_MAP[data.moodWeather] ?? data.moodWeather;

  if (data.spiritAnimal)
    prefs["When you're struggling, your coping style is most like..."] =
      SPIRIT_ANIMAL_MAP[data.spiritAnimal] ?? data.spiritAnimal;

  if (data.lateNightMood)
    prefs["It's 2am. You can't sleep. What's actually going on?"] =
      LATE_NIGHT_MAP[data.lateNightMood] ?? data.lateNightMood;

  if (data.textToSelf)
    prefs["If you could text yourself from 6 months ago, you'd say..."] =
      TEXT_TO_SELF_MAP[data.textToSelf] ?? data.textToSelf;

  if (data.emotionalBattery !== undefined)
    prefs["How full is your emotional battery right now?"] =
      `${data.emotionalBattery}%`;

  if (data.weakestDimension)
    prefs["On a tough day, what goes first?"] =
      WEAKEST_DIMENSION_MAP[data.weakestDimension] ?? data.weakestDimension;

  if (data.ageRange)
    prefs["How old are you?"] =
      AGE_RANGE_MAP[data.ageRange] ?? data.ageRange;

  if (data.gender)
    prefs["How would you describe your gender?"] =
      GENDER_MAP[data.gender] ?? data.gender;

  if (data.emotionalMaturity)
    prefs["What is your emotional maturity?"] =
      MATURITY_MAP[data.emotionalMaturity] ?? data.emotionalMaturity;

  if (data.supportStyle)
    prefs["What kind of support feels right?"] =
      SUPPORT_MAP[data.supportStyle] ?? data.supportStyle;

  return prefs;
}

// ─── Request / Response types ─────────────────────────────────────────────────

interface OnboardingRequest {
  user_id:                    string;
  first_name:                 string;
  last_name:                  null;
  avatar_type:                null;
  avatar_value:               null;
  selected_feelings:          null;
  mood_intensity:             null;
  terms_accepted:             boolean;
  terms_accepted_at:          null;
  notifications_enabled:      boolean;
  microphone_enabled:         boolean;
  age_range:                  string | null;
  avatar_reason:              null;
  discomfort_reasons:         null;
  style:                      null;
  challenge:                  null;
  presence:                   null;
  insight:                    null;
  onboarding_completed:       boolean;
  onboarding_completed_at:    string | null;
  onboarding_user_preferences: Record<string, string>;
}

interface OnboardingResponse {
  id: string;
  user_id: string;
  first_name: string;
  onboarding_completed: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sync new onboarding answers to backend.
 * Fires on Continue press in emotional-mindwave.
 * Only passes first_name, age_range, and onboarding_user_preferences.
 * All old-flow fields are explicitly null.
 */
export async function syncOnboardingToBackend(): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('=== SYNC NEW ONBOARDING TO BACKEND ===');

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('>>> No access token, skipping sync');
      return { success: false, error: 'No access token' };
    }

    const session = await getSession();
    if (!session?.userId) {
      console.log('>>> No userId, skipping sync');
      return { success: false, error: 'No user ID' };
    }

    const data = await getOnboardingData();

    const payload: OnboardingRequest = {
      user_id:                    session.userId,
      first_name:                 (data.firstName ?? '').trim(),
      last_name:                  null,
      avatar_type:                null,
      avatar_value:               null,
      selected_feelings:          null,
      mood_intensity:             null,
      terms_accepted:             false,
      terms_accepted_at:          null,
      notifications_enabled:      false,
      microphone_enabled:         false,
      age_range:                  data.ageRange ?? null,
      avatar_reason:              null,
      discomfort_reasons:         null,
      style:                      null,
      challenge:                  null,
      presence:                   null,
      insight:                    null,
      onboarding_completed:       true,
      onboarding_completed_at:    new Date().toISOString(),
      onboarding_user_preferences: buildPreferences(data),
    };

    console.log('>>> Onboarding payload:', JSON.stringify(payload, null, 2));
    console.log('>>> [syncOnboardingToBackend] POST → /rest/v1/user_onboarding | userId:', session.userId);

    const response = await authPost<OnboardingResponse, OnboardingRequest>(
      ENDPOINTS.USER_ONBOARDING,
      payload,
      accessToken
    );

    if (response.error) {
      console.error('>>> [syncOnboardingToBackend] POST failed:', response.error);
      return { success: false, error: response.error.message };
    }

    console.log('>>> [syncOnboardingToBackend] POST success — onboarding data stored in user_onboarding');
    return { success: true };
  } catch (error: any) {
    console.error('>>> Sync onboarding error:', error);
    return { success: false, error: error.message ?? 'Sync failed' };
  }
}

/**
 * @deprecated  Use syncOnboardingToBackend directly.
 */
export async function completeOnboardingAndSync(): Promise<{
  success: boolean;
  error?: string;
}> {
  return syncOnboardingToBackend();
}
