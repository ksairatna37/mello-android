/**
 * Onboarding API Service
 * Handles syncing onboarding data to backend
 */

import { authPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getOnboardingData, type OnboardingData } from '@/utils/onboardingStorage';
import { getAccessToken, getSession } from '@/services/auth';

// ─── Answer label maps (mirrors questions.tsx) ───────────────────────────────
//
// Mirrors the prose maps in services/chat/bedrockService.ts so the backend
// receives human-readable answers for the 10-question flow. Keep these two
// in sync — if you edit one, edit the other (they share the same source of
// truth: the option text in app/(onboarding)/_components/types.ts).

const NEW_Q1_MAP: Record<string, string> = {
  stormy: 'Stormy — everything feels like too much.',
  rainy:  'Rainy — heavy and slow.',
  foggy:  'Foggy — can’t think straight.',
  cloudy: 'Cloudy — up and down today.',
  okay:   'Surprisingly okay — don’t know why I’m here tbh.',
};
const NEW_Q2_MAP: Record<string, string> = {
  sunday:      'Sunday late afternoon — the anticipatory tax.',
  afternoon:   'The 2–4pm slump — afternoon energy cliff.',
  'post-work': 'Right after work — the re-entry hour.',
  late:        'Late at night — when the quiet gets loud.',
  morning:     'Honestly, mornings — bracing before the day.',
};
const NEW_Q3_MAP: Record<string, string> = {
  turtle:    'The Turtle — I retreat and process quietly alone.',
  butterfly: 'The Butterfly — I need to talk it out to make sense of it.',
  wolf:      'The Wolf — I need my pack; connection heals me.',
  lion:      'The Lion — tell me what to do, I’ll fix it.',
  shell:     'The Shell — I shut down completely first.',
};
const NEW_Q4_MAP: Record<string, string> = {
  calm:            'I stay calm and think clearly.',
  overwhelmed:     'I feel overwhelmed quickly.',
  distract:        'I try to distract myself.',
  'react-recover': 'I react strongly at first but calm down later.',
};
const NEW_Q6_MAP: Record<string, string> = {
  listener: 'I listen and support them.',
  empath:   'I feel their emotions deeply.',
  advisor:  'I try to give practical advice.',
  unsure:   'I feel unsure what to say.',
};
const NEW_Q7_MAP: Record<string, string> = {
  talk:     'I talk to someone about it.',
  immerse:  'I feel it very deeply.',
  private:  'I keep it to myself.',
  fleeting: 'It passes quickly.',
};
const NEW_Q8_MAP: Record<string, string> = {
  'therapy-now':  'Therapy — currently',
  'therapy-past': 'Therapy — in the past',
  medication:     'Medication',
  meditation:     'Meditation / breathwork apps',
  journaling:     'Journaling on my own',
  'first-time':   'This is my first time trying something',
};
const NEW_Q9_MAP: Record<string, string> = {
  '0': '"Not yet" — I’m just looking today',
  '1': 'Seedling — just finding my footing',
  '2': 'Growing — making real progress',
  '3': 'Thriving — deeply grounded',
};
const NEW_TONE_MAP: Record<string, string> = {
  'soft-slow':    'Soft & slow',
  'clear-direct': 'Clear & direct',
  'bit-playful':  'A bit playful',
};

// ─── Build onboarding_user_preferences JSON ──────────────────────────────────

function buildPreferences(data: OnboardingData): Record<string, string> {
  const prefs: Record<string, string> = {};

  if (data.qHeadWeather)
    prefs["What’s the weather inside your head right now?"] =
      NEW_Q1_MAP[data.qHeadWeather] ?? data.qHeadWeather;
  if (data.qHardestTime)
    prefs["When is it hardest?"] =
      NEW_Q2_MAP[data.qHardestTime] ?? data.qHardestTime;
  if (data.qCopingAnimal)
    prefs["When you’re going through something, which is more you?"] =
      NEW_Q3_MAP[data.qCopingAnimal] ?? data.qCopingAnimal;
  if (data.qStressResponse)
    prefs["When something stressful happens…"] =
      NEW_Q4_MAP[data.qStressResponse] ?? data.qStressResponse;
  if (data.emotionalBattery !== undefined && data.emotionalBattery !== null)
    prefs["How full is your emotional battery right now?"] =
      `${data.emotionalBattery}%`;
  if (data.qSupportStyle)
    prefs["When someone shares their problems with you…"] =
      NEW_Q6_MAP[data.qSupportStyle] ?? data.qSupportStyle;
  if (data.qSadnessResponse)
    prefs["When you feel sad…"] =
      NEW_Q7_MAP[data.qSadnessResponse] ?? data.qSadnessResponse;
  if (data.qTriedThings)
    prefs["What have you tried before?"] =
      NEW_Q8_MAP[data.qTriedThings] ?? data.qTriedThings;
  if (data.emotionalGrowth !== undefined && data.emotionalGrowth !== null) {
    const k = String(data.emotionalGrowth);
    prefs["Where are you in your emotional growth?"] = NEW_Q9_MAP[k] ?? k;
  }
  if (typeof data.qMakeItWork === 'string' && data.qMakeItWork.trim().length > 0)
    prefs["What would make this actually work for you?"] = data.qMakeItWork.trim();

  // Personalize signals
  if (Array.isArray(data.personalizeTopics) && data.personalizeTopics.length > 0)
    prefs["What's loud in your head these days?"] =
      data.personalizeTopics.join(', ');
  if (typeof data.personalizeTone === 'string' && data.personalizeTone)
    prefs["How do you want me to sound?"] =
      NEW_TONE_MAP[data.personalizeTone] ?? data.personalizeTone;

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
  terms_accepted_at:          string | null;
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
 * Fires on Continue press in your-reading (or downstream of save-profile).
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
      // Reaching this point implies terms accepted. Honor an explicit
      // false from the local store if it's there, otherwise default true.
      terms_accepted:             data.termsAccepted ?? true,
      terms_accepted_at:          new Date().toISOString(),
      notifications_enabled:      !!data.notificationsEnabled,
      microphone_enabled:         !!data.microphoneEnabled,
      age_range:                  null,
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
