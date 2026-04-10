/**
 * API Endpoints
 * Centralized endpoint configuration
 */

// Base URL for Mello backend (AWS)
export const API_BASE_URL = 'https://me-539b4e0a005d4010ba48937cc598b48a.ecs.ap-south-2.on.aws';

// Auth endpoints
export const ENDPOINTS = {
  // Auth
  AUTH_SIGNUP: '/rest/v1/auth/signup',
  AUTH_LOGIN: '/rest/v1/auth/login',
  AUTH_VERIFY_OTP: '/rest/v1/auth/verify-otp',
  AUTH_RESEND_OTP: '/rest/v1/auth/resend-otp',
  AUTH_RESET_PASSWORD: '/rest/v1/auth/reset-password',
  AUTH_CONFIRM_RESET: '/rest/v1/auth/confirm-reset',
  AUTH_SET_PASSWORD: '/rest/v1/auth/set-password',
  AUTH_DELETE_USER: '/rest/v1/auth/user',

  // Onboarding
  USER_ONBOARDING: '/rest/v1/user_onboarding',

  // Chat
  UPLOAD_CHAT: '/rest/v1/upload/chat',
  LOAD_CHAT: '/rest/v1/load/chat',
  UPDATE_CHAT: '/rest/v1/update/chat',

  // Mood
  MOOD_CHECKINS: '/rest/v1/mood_checkins',

  // Journal
  JOURNAL_ENTRIES: '/rest/v1/journal_entries',

  // Profiles
  PROFILES: '/rest/v1/profiles',
} as const;

// Build full URL
export const buildUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};
