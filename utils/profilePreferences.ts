/**
 * Profile preferences — local cache + writer for the user's editable
 * settings exposed on the PROFILE tab.
 *
 * Schema is 1:1 with `MelloUserPreferences` (the JSON template stored
 * in `profiles.mello_user_preferences`) — same keys, same casing — so
 * we can ship the local cache straight to PATCH without transforming.
 *
 * Backend = source of truth (mirrored into AuthContext.profile);
 * local cache = optimistic UI buffer that hydrates from server on
 * first read and writes through on every change.
 *
 * Why not just read from AuthContext: the rows on the profile tab
 * need to render instantly (no blank state during a re-fetch) and
 * survive a stale-context flip. AsyncStorage is the persistent
 * cache; AuthContext refresh re-hydrates from the server.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MelloUserPreferences } from '@/api/types';

const STORAGE_KEY = 'profilePreferences';

/* ─── Schema (re-export the JSON-aligned types) ──────────────────── */

export type Pronouns       = NonNullable<MelloUserPreferences['pronouns']>;
export type AgeRange       = NonNullable<MelloUserPreferences['age_range']>;
export type VoicePref      = NonNullable<MelloUserPreferences['voice']>;
export type TherapistStyle = NonNullable<MelloUserPreferences['therapist_style']>;

/** Local cache mirrors the backend JSON shape exactly — same keys,
 *  same casing. Writers can hand the cache directly to
 *  `updateMelloUserPreferencesRemote` without rekey'ing. */
export type ProfilePreferences = MelloUserPreferences;

/* ─── In-memory cache + listeners ────────────────────────────────── */

let cache: ProfilePreferences | null = null;
const listeners = new Set<() => void>();

async function hydrate(): Promise<ProfilePreferences> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = Object.freeze(raw ? JSON.parse(raw) : {});
  } catch {
    cache = Object.freeze({});
  }
  return cache as ProfilePreferences;
}

function notify() {
  for (const fn of listeners) fn();
}

async function persist(): Promise<void> {
  if (!cache) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('[profilePreferences] persist failed', err);
  }
}

/* ─── Public API ─────────────────────────────────────────────────── */

export async function getProfilePreferences(): Promise<ProfilePreferences> {
  const c = await hydrate();
  return { ...c };
}

/* Return the cache reference directly. Mutators always allocate a
 * fresh object (`{ ...c, ...patch }`), so the reference changes only
 * when state actually changes — this is what `useSyncExternalStore`
 * needs to avoid an infinite render loop. Do NOT spread here. */
export function getProfilePreferencesSync(): ProfilePreferences | null {
  return cache;
}

/** Idempotent — patches the in-memory cache, persists, notifies.
 *
 *  Note on `updated_at`: deliberately NOT set here. The server owns
 *  the timestamp; setting it locally then again on the wire causes a
 *  mismatch on every successful PATCH, which would re-fire the
 *  hydrate effect and bounce the cache. `updateMelloUserPreferencesRemote`
 *  stamps `updated_at` on the request body; the response hydrates
 *  back into the cache via `hydrateProfilePreferencesFromServer`. */
export async function updateProfilePreferences(
  patch: Partial<ProfilePreferences>,
): Promise<void> {
  const c = await hydrate();
  cache = Object.freeze({ ...c, ...patch });
  notify();
  void persist();
}

export function subscribeProfilePreferences(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Wipe locally — call on signOut so the next user on this device
 *  doesn't inherit the previous user's settings. Mirror pattern of
 *  `clearLikedSpaces` / `clearAllSpaceProgress`. */
export async function clearProfilePreferences(): Promise<void> {
  cache = Object.freeze({});
  notify();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[profilePreferences] clear failed', err);
  }
}

/* ─── Display helpers ────────────────────────────────────────────── */

export const PRONOUNS_OPTIONS: ReadonlyArray<{ key: Pronouns; label: string }> = [
  { key: 'he/him',             label: 'He / Him' },
  { key: 'she/her',            label: 'She / Her' },
  { key: 'they/them',          label: 'They / Them' },
  { key: 'prefer-not-to-say',  label: 'Prefer not to say' },
];

export const AGE_RANGE_OPTIONS: ReadonlyArray<{ key: AgeRange; label: string }> = [
  { key: '13-17',   label: '13–17' },
  { key: '18-21',   label: '18–21' },
  { key: '22-25',   label: '22–25' },
  { key: '26-34',   label: '26–34' },
  { key: '35-44',   label: '35–44' },
  { key: '45-plus', label: '45+'   },
];

export const VOICE_OPTIONS: ReadonlyArray<{ key: VoicePref; label: string }> = [
  { key: 'english', label: 'English' },
  { key: 'hindi',   label: 'Hindi'   },
];

/* Therapist-style options mirror the onboarding personalize-intro
 * tone choices verbatim. */
export const THERAPIST_STYLE_OPTIONS: ReadonlyArray<{ key: TherapistStyle; label: string }> = [
  { key: 'soft-slow',    label: 'Soft & slow' },
  { key: 'clear-direct', label: 'Clear & direct' },
  { key: 'bit-playful',  label: 'A bit playful' },
];

/* Check-in times — pick zero, one, or two. Two slots feels right for an
 * MVP: a morning check-in (anchor the day) and an evening one (review).
 * Adding more would creep into "tracking" territory the design avoids. */
export const CHECK_IN_TIME_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'morning',   label: 'Morning · 9 am' },
  { key: 'midday',    label: 'Midday · 1 pm'  },
  { key: 'afternoon', label: 'Afternoon · 4 pm' },
  { key: 'evening',   label: 'Evening · 9 pm' },
];

export function labelForPronouns(p?: string): string {
  return PRONOUNS_OPTIONS.find((o) => o.key === p)?.label ?? 'Add';
}
export function labelForAgeRange(a?: string): string {
  return AGE_RANGE_OPTIONS.find((o) => o.key === a)?.label ?? 'Add';
}
export function labelForVoice(v?: string): string {
  return VOICE_OPTIONS.find((o) => o.key === v)?.label ?? 'English';
}
export function labelForTherapistStyle(s?: string): string {
  return THERAPIST_STYLE_OPTIONS.find((o) => o.key === s)?.label ?? 'Soft & slow';
}
export function labelForMemory(on?: boolean): string {
  if (on === false) return 'Off';
  return 'On';
}
export function labelForCheckInTimes(slots?: ReadonlyArray<string>): string {
  if (!slots || slots.length === 0) return 'Off';
  const labels = slots
    .map((k) => CHECK_IN_TIME_OPTIONS.find((o) => o.key === k)?.label.split(' · ')[1] ?? k)
    .join(', ');
  return labels;
}

/* ─── Server hydration helper ────────────────────────────────────── */

/** Overlay any server-side prefs onto the local cache. Called from
 *  the profile screen whenever `state.profile.mello_user_preferences`
 *  changes — including on every AuthContext.refreshProfile, which
 *  hands us a NEW object reference even when the underlying data is
 *  identical. We must short-circuit when nothing actually changed,
 *  otherwise we notify subscribers, the screen re-renders, the effect
 *  re-fires, and we loop infinitely. Cheap deep-equal via JSON: the
 *  payload is small (~6 fields) and stringifying twice per refresh is
 *  trivial. Server values win over local on overlap (server is source
 *  of truth). */
export async function hydrateProfilePreferencesFromServer(
  serverPrefs: MelloUserPreferences | null | undefined,
): Promise<void> {
  if (!serverPrefs) return;
  const local = await hydrate();
  const merged = { ...local, ...serverPrefs };
  // Compare excluding `updated_at` — the server bumps that on every
  // PATCH, so naive deep-equal would diverge after every successful
  // write and re-fire the merge → re-render cycle. Exclude here so a
  // change in the timestamp alone doesn't qualify as "changed".
  const stripStamp = (p: ProfilePreferences) => {
    const { updated_at: _ignored, ...rest } = p;
    return rest;
  };
  if (JSON.stringify(stripStamp(merged)) === JSON.stringify(stripStamp(local))) return;
  cache = Object.freeze(merged);
  notify();
  void persist();
}
