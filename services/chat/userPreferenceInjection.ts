/**
 * userPreferenceInjection — builds the system-prompt addendum that
 * makes the chat agent context-aware of the user's PROFILE-tab
 * preferences (pronouns / age range / preferred tone / language /
 * check-in times).
 *
 * Memory toggle:
 *   When `memory_enabled === false`, this returns `null` — the
 *   system prompt gets no user context at all and every session is a
 *   clean slate. The off branch is intentionally a single boolean
 *   check so flipping the toggle takes effect on the very next
 *   message (no cache to invalidate, no rebuild needed).
 *
 * Read path:
 *   `getProfilePreferencesSync()` is the in-memory cache populated
 *   when the user lands on the profile tab (and re-hydrated from
 *   `state.profile.mello_user_preferences` on every refresh). On a
 *   fresh launch before the user opens Profile, the cache is null
 *   and we return null — same as memory-off. Acceptable: the chat
 *   degrades gracefully to baseline behavior until the user has
 *   opened Profile once OR the AuthContext profile fetch finishes.
 *
 *   v1.1 work (if needed): add a hydration call in `app/_layout.tsx`
 *   so the cache is warm before any chat send. For now the
 *   refreshProfile cycle is fast enough that mid-session sends are
 *   guaranteed warm.
 */

import { getProfilePreferencesSync } from '@/utils/profilePreferences';
import {
  AGE_RANGE_OPTIONS,
  PRONOUNS_OPTIONS,
  THERAPIST_STYLE_OPTIONS,
  VOICE_OPTIONS,
  CHECK_IN_TIME_OPTIONS,
} from '@/utils/profilePreferences';

function labelOf<T extends string>(
  options: ReadonlyArray<{ key: T; label: string }>,
  key: T | undefined,
): string | null {
  if (!key) return null;
  return options.find((o) => o.key === key)?.label ?? null;
}

/** Build the user-preference system-prompt addendum, or `null` when
 *  memory is off OR no fields are populated yet. The result is plain
 *  text the model sees as part of its system instructions; no JSON,
 *  no tool calls.
 *
 *  `name` is sourced from `profiles.username` (or the local onboarding
 *  mirror) by the caller — it lives outside `mello_user_preferences`
 *  in the schema, so we can't read it from the prefs cache here. The
 *  caller passes it through `SendToBedrockOptions.userName`. */
export function buildUserPreferenceAddendum(name?: string | null): string | null {
  const prefs = getProfilePreferencesSync();
  // Allow the addendum even if prefs cache is empty, as long as we
  // at least have a name. A user who's never opened the Profile tab
  // still benefits from the model knowing what to call them.
  const memoryOff = prefs?.memory_enabled === false;
  if (memoryOff) return null;

  const lines: string[] = [];

  const trimmedName = name?.trim();
  if (trimmedName) {
    lines.push(`- Name: ${trimmedName}`);
  }

  const pronounsLabel = labelOf(PRONOUNS_OPTIONS, prefs?.pronouns);
  if (pronounsLabel && prefs?.pronouns !== 'prefer-not-to-say') {
    lines.push(`- Pronouns: ${pronounsLabel}`);
  }

  const ageLabel = labelOf(AGE_RANGE_OPTIONS, prefs?.age_range);
  if (ageLabel) {
    lines.push(`- Age range: ${ageLabel}`);
  }

  const toneLabel = labelOf(THERAPIST_STYLE_OPTIONS, prefs?.therapist_style);
  if (toneLabel) {
    lines.push(`- Preferred tone: ${toneLabel}`);
  }

  const voiceLabel = labelOf(VOICE_OPTIONS, prefs?.voice);
  if (voiceLabel) {
    lines.push(`- Preferred language: ${voiceLabel}`);
  }

  if (Array.isArray(prefs?.check_in_times) && prefs.check_in_times.length > 0) {
    const labels = prefs.check_in_times
      .map(
        (k) =>
          CHECK_IN_TIME_OPTIONS.find((o) => o.key === k)?.label
            .split(' · ')[0]
            ?.toLowerCase() ?? k,
      )
      .join(', ');
    lines.push(`- Preferred check-in windows: ${labels}`);
  }

  if (lines.length === 0) return null;

  return [
    'About this user (use to ground tone — never quote back verbatim):',
    ...lines,
  ].join('\n');
}
