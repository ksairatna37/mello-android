/**
 * Onboarding storage — local AsyncStorage of the user's answers
 * collected through the (onboarding) flow.
 *
 * Architecture: simple adapter so we can swap storage backends later
 * without changing the public API surface.
 *
 * Schema policy: this type is the *single source of truth* for what
 * the onboarding flow may persist locally. Legacy fields from the
 * pre-redesign "get-rolling" flow have been removed (see
 * migrateOnboardingData below for the strip-on-boot helper).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Schema ──────────────────────────────────────────────────────────

export interface OnboardingData {
  // name-input
  firstName?: string;
  lastName?: string;

  // save-profile
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  email?: string;
  emailVerified?: boolean;

  // permissions
  notificationsEnabled?: boolean;
  microphoneEnabled?: boolean;

  // personalize-intro
  personalizeTopics?: string[];
  personalizeTone?: string;

  // 10-question flow
  qHeadWeather?: string;     // Q1 — weather inside your head
  qHardestTime?: string;     // Q2
  qCopingAnimal?: string;    // Q3 — turtle / butterfly / wolf / lion / shell
  qStressResponse?: string;  // Q4 — when something stressful happens
  emotionalBattery?: string; // Q5 (0–100 as string)
  qSupportStyle?: string;    // Q6 — when someone shares with you
  qSadnessResponse?: string; // Q7 — when you feel sad
  qTriedThings?: string;     // Q8
  emotionalGrowth?: string;  // Q9 (0–3)
  qMakeItWork?: string;      // Q10 (freeform)

  // completion
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string;

  // timestamps
  createdAt?: string;
  updatedAt?: string;
}

// ─── Adapter ─────────────────────────────────────────────────────────

interface StorageAdapter {
  get(): Promise<OnboardingData>;
  set(data: OnboardingData): Promise<void>;
  update(updates: Partial<OnboardingData>): Promise<void>;
  clear(): Promise<void>;
}

const STORAGE_KEY = 'onboardingData';

class AsyncStorageAdapter implements StorageAdapter {
  async get(): Promise<OnboardingData> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('[OnboardingStorage] Get failed:', e);
      return {};
    }
  }

  async set(data: OnboardingData): Promise<void> {
    try {
      const withTimestamp = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(withTimestamp));
    } catch (e) {
      console.error('[OnboardingStorage] Set failed:', e);
    }
  }

  async update(updates: Partial<OnboardingData>): Promise<void> {
    try {
      const existing = await this.get();
      const merged = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      if (!existing.createdAt) {
        merged.createdAt = new Date().toISOString();
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.error('[OnboardingStorage] Update failed:', e);
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('[OnboardingStorage] Clear failed:', e);
    }
  }
}

const adapter: StorageAdapter = new AsyncStorageAdapter();

// ─── Public API ──────────────────────────────────────────────────────

export async function getOnboardingData(): Promise<OnboardingData> {
  return adapter.get();
}

export async function setOnboardingData(data: OnboardingData): Promise<void> {
  return adapter.set(data);
}

export async function updateOnboardingData(updates: Partial<OnboardingData>): Promise<void> {
  return adapter.update(updates);
}

export async function getOnboardingField<K extends keyof OnboardingData>(
  field: K
): Promise<OnboardingData[K] | undefined> {
  const data = await getOnboardingData();
  return data[field];
}

export async function clearOnboardingData(): Promise<void> {
  return adapter.clear();
}

// ─── One-time schema migration (called from app boot) ────────────────

/**
 * Legacy keys that may still sit in AsyncStorage from the
 * pre-redesign flow. Stripped on boot so old payloads can't leak
 * stale fields back into the new flow.
 */
const LEGACY_KEYS = [
  'avatarType', 'avatarValue',
  'selectedFeelings', 'moodIntensity',
  'moodWeather', 'spiritAnimal', 'lateNightMood',
  'textToSelf', 'textToSelfCustom', 'weakestDimension',
  'emotionalMaturity',
  'ageRange', 'gender', 'supportStyle',
  'avatarReason', 'discomfortReasons',
  'style', 'challenge', 'presence', 'insight',
  'completedSteps', 'currentStep',
  // Pre-2026-05 question schema (replaced by qHeadWeather / qCopingAnimal /
  // qStressResponse / qSupportStyle / qSadnessResponse).
  'qBringHere', 'qBodyLocation', 'qInnerVoice', 'qVillage', 'qRest',
] as const;

const LEGACY_AVATAR_KEY = 'userAvatar';

/**
 * Strip legacy fields from any stored payload. Idempotent — safe to
 * call on every boot. Also removes the legacy 'userAvatar' AsyncStorage
 * entry left over from the old avatar flow.
 */
export async function migrateOnboardingData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_AVATAR_KEY);

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    let touched = false;
    for (const key of LEGACY_KEYS) {
      if (key in parsed) {
        delete parsed[key];
        touched = true;
      }
    }
    if (touched) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      console.log('[OnboardingStorage] migrated: stripped legacy keys');
    }
  } catch (e) {
    console.error('[OnboardingStorage] migrate failed:', e);
  }
}
