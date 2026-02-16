/**
 * Onboarding Storage Utility
 * Centralized storage for all onboarding user data
 *
 * Architecture: Adapter pattern for easy database migration
 * - Currently uses AsyncStorage (local)
 * - Can easily switch to Supabase/database by changing the adapter
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// DATA TYPES
// ============================================================================

export interface OnboardingData {
  // Name input (Step 3)
  firstName?: string;
  lastName?: string;

  // Profile picture / Avatar (Step 4)
  avatarType?: 'emoji' | 'icon' | 'image' | null;
  avatarValue?: string | null;

  // Feelings selection (Step 5)
  selectedFeelings?: string[];

  // Mood weight (Step 6)
  moodIntensity?: number;

  // Terms accepted (Step 7)
  termsAccepted?: boolean;
  termsAcceptedAt?: string;

  // Email verification (Step 8)
  email?: string;
  emailVerified?: boolean;

  // Permissions (Step 9)
  notificationsEnabled?: boolean;
  microphoneEnabled?: boolean;

  // Get Rolling flow data
  ageRange?: string;           // Age selection (under-18, 18-24, 25-34, etc.)
  avatarReason?: string;       // Why they picked their avatar
  discomfortReasons?: string[]; // What's weighing on them (multi-select)

  // Completion tracking
  completedSteps?: string[];
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// STORAGE ADAPTER INTERFACE
// ============================================================================

interface StorageAdapter {
  get(): Promise<OnboardingData>;
  set(data: OnboardingData): Promise<void>;
  update(updates: Partial<OnboardingData>): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================================
// ASYNC STORAGE ADAPTER (Current - Local Storage)
// ============================================================================

const STORAGE_KEY = 'onboardingData';
const AVATAR_LEGACY_KEY = 'userAvatar'; // For backward compatibility

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
      await AsyncStorage.removeItem(AVATAR_LEGACY_KEY);
    } catch (e) {
      console.error('[OnboardingStorage] Clear failed:', e);
    }
  }
}

// ============================================================================
// SUPABASE ADAPTER (Future - Database Storage)
// Uncomment and implement when ready to use database
// ============================================================================

// import { supabase } from '@/lib/supabase';
//
// class SupabaseAdapter implements StorageAdapter {
//   private userId: string;
//
//   constructor(userId: string) {
//     this.userId = userId;
//   }
//
//   async get(): Promise<OnboardingData> {
//     const { data, error } = await supabase
//       .from('user_onboarding')
//       .select('*')
//       .eq('user_id', this.userId)
//       .single();
//
//     if (error) {
//       console.error('[OnboardingStorage] Supabase get failed:', error);
//       return {};
//     }
//     return data || {};
//   }
//
//   async set(data: OnboardingData): Promise<void> {
//     const { error } = await supabase
//       .from('user_onboarding')
//       .upsert({
//         user_id: this.userId,
//         ...data,
//         updated_at: new Date().toISOString(),
//       });
//
//     if (error) {
//       console.error('[OnboardingStorage] Supabase set failed:', error);
//     }
//   }
//
//   async update(updates: Partial<OnboardingData>): Promise<void> {
//     const { error } = await supabase
//       .from('user_onboarding')
//       .update({
//         ...updates,
//         updated_at: new Date().toISOString(),
//       })
//       .eq('user_id', this.userId);
//
//     if (error) {
//       console.error('[OnboardingStorage] Supabase update failed:', error);
//     }
//   }
//
//   async clear(): Promise<void> {
//     const { error } = await supabase
//       .from('user_onboarding')
//       .delete()
//       .eq('user_id', this.userId);
//
//     if (error) {
//       console.error('[OnboardingStorage] Supabase clear failed:', error);
//     }
//   }
// }

// ============================================================================
// ACTIVE ADAPTER
// Change this to switch storage backends
// ============================================================================

const adapter: StorageAdapter = new AsyncStorageAdapter();

// To switch to Supabase in the future:
// const adapter: StorageAdapter = new SupabaseAdapter(userId);

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get all onboarding data
 */
export async function getOnboardingData(): Promise<OnboardingData> {
  return adapter.get();
}

/**
 * Set all onboarding data (replaces existing)
 */
export async function setOnboardingData(data: OnboardingData): Promise<void> {
  return adapter.set(data);
}

/**
 * Update onboarding data (merges with existing)
 */
export async function updateOnboardingData(updates: Partial<OnboardingData>): Promise<void> {
  return adapter.update(updates);
}

/**
 * Get specific field from onboarding data
 */
export async function getOnboardingField<K extends keyof OnboardingData>(
  field: K
): Promise<OnboardingData[K] | undefined> {
  const data = await getOnboardingData();
  return data[field];
}

/**
 * Mark a step as completed
 */
export async function markStepCompleted(stepName: string): Promise<void> {
  const data = await getOnboardingData();
  const completedSteps = data.completedSteps || [];
  if (!completedSteps.includes(stepName)) {
    completedSteps.push(stepName);
    await updateOnboardingData({ completedSteps });
  }
}

/**
 * Mark onboarding as fully completed
 */
export async function completeOnboarding(): Promise<void> {
  await updateOnboardingData({
    onboardingCompleted: true,
    onboardingCompletedAt: new Date().toISOString(),
  });
}

/**
 * Clear all onboarding data (for testing/reset)
 */
export async function clearOnboardingData(): Promise<void> {
  return adapter.clear();
}

/**
 * Save avatar with legacy support
 * Also saves to legacy key for existing code that reads 'userAvatar'
 */
export async function saveAvatar(
  type: 'emoji' | 'icon' | 'image' | null,
  value: string | null
): Promise<void> {
  // Save to unified storage
  await updateOnboardingData({ avatarType: type, avatarValue: value });

  // Also save to legacy key for backward compatibility
  try {
    await AsyncStorage.setItem(AVATAR_LEGACY_KEY, JSON.stringify({ type, value }));
  } catch (e) {
    console.error('[OnboardingStorage] Legacy avatar save failed:', e);
  }
}

/**
 * Get avatar data
 */
export async function getAvatar(): Promise<{ type: string | null; value: string | null }> {
  const data = await getOnboardingData();
  return {
    type: data.avatarType || null,
    value: data.avatarValue || null,
  };
}
