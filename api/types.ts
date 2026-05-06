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
  /** Single JSON column on `profiles` carrying the user-tunable PROFILE
   *  tab preferences (pronouns / age / voice / memory / check-in times
   *  / therapist style). See `MelloUserPreferences` for the agreed
   *  template. May be null on never-edited rows. */
  mello_user_preferences?: MelloUserPreferences | null;
}

/* JSON template for `profiles.mello_user_preferences`. Snake_case keys
 * to match other table-column conventions. All fields optional — only
 * present after the user has actually set them via the PROFILE tab. */
export interface MelloUserPreferences {
  pronouns?: 'he/him' | 'she/her' | 'they/them' | 'prefer-not-to-say';
  age_range?: '13-17' | '18-21' | '22-25' | '26-34' | '35-44' | '45-plus';
  voice?: 'english' | 'hindi';
  memory_enabled?: boolean;
  check_in_times?: ReadonlyArray<string>;
  therapist_style?: 'soft-slow' | 'clear-direct' | 'bit-playful';
  updated_at?: string;
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

/* ─── Practice page persistence (profile columns) ───────────────────
 * Backed by columns added to public.profiles:
 *   practice_liked         text[]  — array of practice ids hearted
 *   practice_stats         jsonb   — per-practice counters (read-modify-write)
 *   practice_last_used_at  jsonb   — per-practice last-opened ISO string
 *   practice_ui_hints      jsonb   — one-time UI hint flags (replaces AsyncStorage)
 *
 * All four are NOT NULL with default '{}' / '{}'::jsonb on the server,
 * so the app never has to handle nulls — but we type them optional
 * here for safety against older row snapshots. */

/** Per-practice counter shape stored under practice_stats[<practiceId>]. */
export interface PracticeCounters {
  /** Total completed sessions for this practice. */
  totalSessions?: number;
  /** Box-breath specific — total cycles across all sessions. */
  totalCycles?: number;
  /** Last session's cycles, for the post-session UI to read back. */
  lastCycles?: number;
  /** Last session's elapsed seconds. */
  lastSecs?: number;
  /** Brain-dump specific — total thoughts captured across all opens. */
  thoughtsAdded?: number;
  /** Free-form extension surface — practice-specific keys can be
   *  added without touching the type, but prefer adding a typed
   *  field above for grep-ability. */
  [key: string]: unknown;
}

export type PracticeStatsMap = Record<string, PracticeCounters>;
export type PracticeLastUsedAtMap = Record<string, string>;
export type PracticeUiHintsMap = Record<string, boolean>;

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
  /* Practice persistence — see block comment above. */
  practice_liked?: string[];
  practice_stats?: PracticeStatsMap;
  practice_last_used_at?: PracticeLastUsedAtMap;
  practice_ui_hints?: PracticeUiHintsMap;
}

export interface UpdateProfileRequest {
  username?: string;
  avatar_url?: string;
  first_login?: boolean;
  mello_user_preferences?: Record<string, unknown>;
  /* Practice persistence — partial PATCH allowed; unspecified fields
   * are untouched server-side. PATCH semantics on jsonb columns
   * REPLACE the whole value, so callers must read-modify-write the
   * stats / last-used / hints maps locally before sending. */
  practice_liked?: string[];
  practice_stats?: PracticeStatsMap;
  practice_last_used_at?: PracticeLastUsedAtMap;
  practice_ui_hints?: PracticeUiHintsMap;
  // Add other writable fields as needed
}

export interface DeleteProfileResponse {
  id: string;
  deleted: boolean;
}
