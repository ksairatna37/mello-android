/**
 * Onboarding API Service
 * Handles syncing onboarding data to backend
 */

import { authPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getOnboardingData, type OnboardingData } from '@/utils/onboardingStorage';
import { getAccessToken, getSession } from '@/services/auth';

// Backend onboarding request type (snake_case)
interface OnboardingRequest {
  user_id: string;
  first_name: string;
  last_name?: string;
  avatar_type?: string;
  avatar_value?: string;
  selected_feelings?: string[];
  mood_intensity?: number | null;
  terms_accepted: boolean;
  terms_accepted_at?: string;
  notifications_enabled?: boolean;
  microphone_enabled?: boolean;
  age_range?: string;
  avatar_reason?: string;
  discomfort_reasons?: string[];
  style?: string;
  challenge?: string;
  presence?: string;
  insight?: string;
  onboarding_completed: boolean;
  onboarding_completed_at?: string;
}

// Backend response type
interface OnboardingResponse {
  id: string;
  user_id: string;
  first_name: string;
  onboarding_completed: boolean;
  // ... other fields
}

/**
 * Convert local onboarding data (camelCase) to backend format (snake_case)
 * Only includes fields that have actual values (skips undefined/null)
 */
function toBackendFormat(data: OnboardingData, userId: string): OnboardingRequest {
  const payload: OnboardingRequest = {
    // Required fields
    user_id: userId,
    first_name: data.firstName || '',
    terms_accepted: data.termsAccepted || false,
    onboarding_completed: data.onboardingCompleted || false,
  };

  // Optional fields - only add if they have values
  if (data.lastName) payload.last_name = data.lastName;
  if (data.avatarType) payload.avatar_type = data.avatarType;
  if (data.avatarValue) payload.avatar_value = data.avatarValue;
  if (data.selectedFeelings?.length) payload.selected_feelings = data.selectedFeelings;
  if (data.moodIntensity !== undefined) payload.mood_intensity = data.moodIntensity;
  if (data.termsAcceptedAt) payload.terms_accepted_at = data.termsAcceptedAt;
  if (data.notificationsEnabled !== undefined) payload.notifications_enabled = data.notificationsEnabled;
  if (data.microphoneEnabled !== undefined) payload.microphone_enabled = data.microphoneEnabled;
  if (data.ageRange) payload.age_range = data.ageRange;
  if (data.avatarReason) payload.avatar_reason = data.avatarReason;
  if (data.discomfortReasons?.length) payload.discomfort_reasons = data.discomfortReasons;
  if (data.onboardingCompletedAt) payload.onboarding_completed_at = data.onboardingCompletedAt;

  // Get-rolling conversational fields - only add if collected
  if (data.style) payload.style = data.style;
  if (data.challenge) payload.challenge = data.challenge;
  if (data.presence) payload.presence = data.presence;
  if (data.insight) payload.insight = data.insight;

  return payload;
}

/**
 * Sync onboarding data to backend
 * Collects all local data and sends to POST /rest/v1/user_onboarding
 */
export async function syncOnboardingToBackend(): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('=== SYNC ONBOARDING TO BACKEND ===');

  try {
    // Get access token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('>>> No access token, skipping backend sync');
      return { success: false, error: 'No access token' };
    }

    // Get session for userId
    const session = await getSession();
    if (!session?.userId) {
      console.log('>>> No userId in session, skipping backend sync');
      return { success: false, error: 'No user ID' };
    }

    // Get local onboarding data
    const localData = await getOnboardingData();
    console.log('>>> Local onboarding data:', JSON.stringify(localData, null, 2));

    // Convert to backend format
    const backendData = toBackendFormat(localData, session.userId);
    console.log('>>> Backend payload:', JSON.stringify(backendData, null, 2));

    // Send to backend
    const response = await authPost<OnboardingResponse, OnboardingRequest>(
      ENDPOINTS.USER_ONBOARDING,
      backendData,
      accessToken
    );

    if (response.error) {
      console.error('>>> Backend sync failed:', response.error);
      return { success: false, error: response.error.message };
    }

    console.log('>>> Onboarding synced to backend successfully');
    return { success: true };
  } catch (error: any) {
    console.error('>>> Sync onboarding error:', error);
    return { success: false, error: error.message || 'Sync failed' };
  }
}

/**
 * Mark onboarding as complete and sync to backend
 */
export async function completeOnboardingAndSync(): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('=== COMPLETE ONBOARDING AND SYNC ===');

  try {
    // Import here to avoid circular dependency
    const { completeOnboarding: markComplete } = await import('@/utils/onboardingStorage');

    // Mark as complete locally
    await markComplete();
    console.log('>>> Marked complete locally');

    // Sync to backend
    const syncResult = await syncOnboardingToBackend();

    if (!syncResult.success) {
      console.log('>>> Backend sync failed but local is complete:', syncResult.error);
      // Don't fail the whole operation if sync fails
      // The data is saved locally and can be synced later
    }

    return { success: true };
  } catch (error: any) {
    console.error('>>> Complete onboarding error:', error);
    return { success: false, error: error.message || 'Failed to complete onboarding' };
  }
}
