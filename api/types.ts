/**
 * API Types
 * Shared types for API requests and responses
 */

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

// API error structure
export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

// ═══════════════════════════════════════════════════
// AUTH TYPES
// ═══════════════════════════════════════════════════

// Profile object returned in auth responses
export interface ProfileData {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  email_id?: string | null;
  first_login?: boolean | null;
  created_at?: string;
  updated_at?: string;
  referral_code?: string | null;
  referral_count?: number;
}

// Signup
export interface SignupRequest {
  email: string;
  password: string;
}

export interface SignupResponse {
  user_id: string;
  email: string;
  profile: ProfileData;
}

// Login
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  profile: ProfileData;
}

// Verify OTP
export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  message: string;
  code: string;
  user_id: string;
  email: string;
  profile: ProfileData;
}

// Resend OTP
export interface ResendOtpRequest {
  email: string;
}

export interface ResendOtpResponse {
  message: string;
  code: string;
}

// Reset Password (Step 1)
export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordResponse {
  message: string;
  code: string;
}

// Confirm Reset (Step 2)
export interface ConfirmResetRequest {
  email: string;
  otp: string;
  new_password: string;
}

export interface ConfirmResetResponse {
  message: string;
  code: string;
  user_id: string;
}

// Set Password (for OAuth users)
export interface SetPasswordRequest {
  email?: string;
  user_id?: string;
  new_password: string;
}

export interface SetPasswordResponse {
  message: string;
  code: string;
  user_id: string;
}

// Delete User
export interface DeleteUserRequest {
  user_id?: string;
  email?: string;
}

export interface DeleteUserResponse {
  message: string;
  code: string;
  user_id: string;
}

// ═══════════════════════════════════════════════════
// ONBOARDING TYPES
// ═══════════════════════════════════════════════════

export interface UserOnboardingRequest {
  user_id: string;
  first_name: string;
  terms_accepted: boolean;
  onboarding_completed: boolean;
  last_name?: string;
  avatar_type?: 'emoji' | 'icon' | 'image';
  avatar_value?: string;
  selected_feelings?: string[];
  mood_intensity?: number | null;
  notifications_enabled?: boolean;
  microphone_enabled?: boolean;
  age_range?: string;
  avatar_reason?: string;
  discomfort_reasons?: string[];
  style?: string;
  challenge?: string;
  presence?: string;
  insight?: string;
  terms_accepted_at?: string;
  onboarding_completed_at?: string;
}

export interface UserOnboardingResponse {
  id: string;
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
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════
// CHAT TYPES
// ═══════════════════════════════════════════════════

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface UploadChatRequest {
  user_id: string;
  chat: {
    messages: ChatMessage[];
  };
}

export interface LoadChatRequest {
  user_id: string;
}

export interface LoadChatResponse {
  messages: ChatMessage[];
}

export interface UpdateChatRequest {
  user_id: string;
  chat: {
    messages: ChatMessage[];
  };
}

// ═══════════════════════════════════════════════════
// MOOD TYPES
// ═══════════════════════════════════════════════════

export interface MoodCheckinRequest {
  user_id: string;
  mood: Record<string, unknown>;
}

export interface MoodCheckinResponse {
  mood: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════
// JOURNAL TYPES
// ═══════════════════════════════════════════════════

export interface JournalEntryRequest {
  user_id: string;
  journal: Record<string, unknown>;
}

export interface JournalEntryResponse {
  journal: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════
// PROFILE TYPES
// ═══════════════════════════════════════════════════

export interface ProfileResponse extends ProfileData {
  mello_user_preferences?: Record<string, unknown> | null;
  twitter_connected?: boolean | null;
  twitter_data?: Record<string, unknown> | null;
  duration?: number;
  usage?: Record<string, unknown> | null;
  login_detail?: Record<string, unknown> | null;
  base_wallet?: string | null;
  wallet_verified?: boolean | null;
  wallet_address?: string | null;
  wallet_chain?: string | null;
  wallet_connected?: boolean;
  wallet_points_received?: boolean;
  internal_access?: boolean | null;
}

export interface UpdateProfileRequest {
  username?: string;
  avatar_url?: string;
  first_login?: boolean;
  mello_user_preferences?: Record<string, unknown>;
  // Add other writable fields as needed
}

export interface DeleteProfileResponse {
  id: string;
  deleted: boolean;
}
