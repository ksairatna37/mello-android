/**
 * Profile-settings backend writers.
 *
 * Two live-PATCH paths covering every editable row on the PROFILE
 * tab. All write best-effort (fire-and-forget from the UI's POV) —
 * local-state updates are optimistic; backend mirror is durable but
 * not blocking. Failures are logged, never thrown to the caller.
 *
 * Field → endpoint map:
 *   username                                  → PATCH /rest/v1/profiles?id=<userId>
 *   pronouns / age_range / voice / memory_enabled
 *     / check_in_times / therapist_style      → PATCH /rest/v1/profiles?id=<userId>
 *                                              { mello_user_preferences: { ... } }
 *
 * The `mello_user_preferences` JSON is a flexible single record on
 * `profiles`. Schema agreed in `MelloUserPreferences` (see
 * `api/types.ts`). We send the full merged template every time — local
 * state is the canonical source for the UI, the JSON column is its
 * durable mirror. Any keys the user hasn't set yet are simply absent.
 *
 * Auth: every call goes through `authPatch` with a fresh Bearer token
 * pulled from `services/auth`. If there's no token, we skip silently.
 */

import { authPatch } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getAccessToken, getSession } from '@/services/auth';
import type { MelloUserPreferences } from '@/api/types';

/* ─── profiles.username ───────────────────────────────────────────── */

interface ProfileUsernamePatchBody {
  username?: string | null;
}

/** Update the user's display name on the `profiles` table. Resolves
 *  with `true` on 2xx, `false` on auth/network/error. Never throws. */
export async function updateUsernameRemote(name: string): Promise<boolean> {
  try {
    const token = await getAccessToken();
    const session = await getSession();
    if (!token || !session?.userId) return false;

    const trimmed = name.trim();
    const body: ProfileUsernamePatchBody = {
      username: trimmed.length > 0 ? trimmed : null,
    };

    const res = await authPatch<unknown, ProfileUsernamePatchBody>(
      ENDPOINTS.PROFILES_UPDATE(session.userId),
      body,
      token,
    );
    if (res.error) {
      console.warn('[profileSettingsApi] updateUsername failed', res.error?.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[profileSettingsApi] updateUsername threw', err);
    return false;
  }
}

/* ─── profiles.mello_user_preferences ─────────────────────────────── */

interface ProfilePrefsPatchBody {
  mello_user_preferences: MelloUserPreferences;
}

/** PATCH the full `mello_user_preferences` JSON. The caller owns the
 *  merge — pass the entire object you want stored. Any keys absent
 *  from the payload are CLEARED on the server, so always merge with
 *  the existing local value before calling. Best-effort. */
export async function updateMelloUserPreferencesRemote(
  prefs: MelloUserPreferences,
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    const session = await getSession();
    if (!token || !session?.userId) return false;

    const body: ProfilePrefsPatchBody = {
      mello_user_preferences: {
        ...prefs,
        updated_at: new Date().toISOString(),
      },
    };

    const res = await authPatch<unknown, ProfilePrefsPatchBody>(
      ENDPOINTS.PROFILES_UPDATE(session.userId),
      body,
      token,
    );
    if (res.error) {
      console.warn('[profileSettingsApi] updatePrefs failed', res.error?.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[profileSettingsApi] updatePrefs threw', err);
    return false;
  }
}
