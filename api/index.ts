/**
 * API Module - Barrel Export
 */

export { request, get, post } from './client';
export { API_BASE_URL, ENDPOINTS, buildUrl } from './endpoints';
export type {
  ApiResponse,
  ApiError,
  // Auth types
  ProfileData,
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ResendOtpRequest,
  ResendOtpResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ConfirmResetRequest,
  ConfirmResetResponse,
  SetPasswordRequest,
  SetPasswordResponse,
  DeleteUserRequest,
  DeleteUserResponse,
  // Onboarding types
  UserOnboardingRequest,
  UserOnboardingResponse,
  // Chat types
  ChatMessage,
  UploadChatRequest,
  LoadChatRequest,
  LoadChatResponse,
  UpdateChatRequest,
  // Mood types
  MoodCheckinRequest,
  MoodCheckinResponse,
  // Journal types
  JournalEntryRequest,
  JournalEntryResponse,
  // Profile types
  ProfileResponse,
  UpdateProfileRequest,
  DeleteProfileResponse,
} from './types';
