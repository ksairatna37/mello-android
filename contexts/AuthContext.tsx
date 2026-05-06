/**
 * Auth Context for Mello Android
 *
 * Provides authentication state and methods throughout the app:
 * - Email/Password Sign-In/Sign-Up (via backend API)
 * - Native Google Sign-In (in-app popup via Supabase)
 * - Sign out
 * - Auth state listener
 * - Profile management
 *
 * Post-auth flow:
 * - New user → Onboarding
 * - Existing user (incomplete onboarding) → Onboarding
 * - Existing user (complete onboarding) → Home
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
  useCallback,
} from 'react';
import { Platform } from 'react-native';
import { User, Session } from '@supabase/supabase-js';
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';

// Backend auth services
import {
  login as backendLogin,
  signup as backendSignup,
  verifyOtp as backendVerifyOtp,
  resendOtp as backendResendOtp,
  saveSession,
  getSession,
  clearSession,
} from '@/services/auth';
import {
  getAccessToken,
  type AuthProvider,
} from '@/services/auth';
import {
  seedFromProfile as seedPracticeFromProfile,
  clearCache as clearPracticeCache,
  flushPending as flushPendingPracticeWrites,
} from '@/services/practice/practiceProfileSync';
import { clearLikedSpaces } from '@/services/spaces/likedSpaces';
import { clearAllSpaceProgress } from '@/services/spaces/spaceProgress';
import { clearProfilePreferences } from '@/utils/profilePreferences';
import { clearUserMemoryCache } from '@/services/chat/userMemoryDigest';
import type { ProfileResponse } from '@/api/types';
import { authPatch, authGet, post } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

// Onboarding storage (for clearing on logout)
import { clearOnboardingData, getOnboardingData } from '@/utils/onboardingStorage';
import { clearEmotionalProfile } from '@/utils/emotionalProfileCache';

// Google OAuth Client IDs
// Get these from Google Cloud Console -> Credentials -> OAuth 2.0 Client IDs
const GOOGLE_WEB_CLIENT_ID = '499732705533-9lmeh4ah0rvbb6f6dirtudmf6gts7avb.apps.googleusercontent.com';

// iOS Client ID - From Google Cloud Console (Bundle ID: health.melloai.app)
const GOOGLE_IOS_CLIENT_ID = '499732705533-ot31akqnmvgvona2a89j2dbhfle7a2om.apps.googleusercontent.com';

/**
 * Generate a random nonce for iOS Google Sign-In
 * Returns both raw nonce (for Supabase) and hashed nonce (for Google)
 */
async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );
  return { raw: rawNonce, hashed: hashedNonce };
}

// Store the current nonce for iOS sign-in
let currentNonce: string | null = null;

// Configure Google Sign-In (will be reconfigured on iOS before each sign-in)
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  offlineAccess: true,
  scopes: ['profile', 'email'],
});

/**
 * Retry an async operation with exponential backoff.
 *
 * Used by completeOnboarding's two phases. Simple, no jitter (we don't
 * have many concurrent clients), no AbortController (callers don't need
 * to cancel mid-finalize).
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: { attempts: number; baseMs: number; label: string },
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < opts.attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = i === opts.attempts - 1;
      console.warn(
        `>>> [retry:${opts.label}] attempt ${i + 1}/${opts.attempts} failed:`,
        err instanceof Error ? err.message : err,
      );
      if (isLast) break;
      const delay = opts.baseMs * Math.pow(2, i); // 600ms → 1200ms → 2400ms
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// Profile interface matching the web app
interface Profile {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  email_id?: string | null;
  first_login?: boolean | null;
  onboarding_completed?: boolean | null;
  created_at?: string;
  updated_at?: string;
  /* Practice persistence columns — see api/types.ts ProfileResponse
   * for shape docs. Optional here for the same null-safety reason. */
  practice_liked?: string[];
  practice_stats?: Record<string, Record<string, unknown>>;
  practice_last_used_at?: Record<string, string>;
  practice_ui_hints?: Record<string, boolean>;
}

// Email user (for backend auth - no Supabase User object)
interface EmailUser {
  email: string;
  userId?: string;
  provider: 'email';
}

/**
 * Single source of truth for routing decisions. RouterGate subscribes to
 * `state` and is the only file that calls router.replace for the auth /
 * onboarding flow. Every other navigation in the app is user-initiated
 * forward navigation (e.g. clicking Continue), never a state-driven redirect.
 *
 * State machine:
 *   loading      → boot in progress, no decision yet
 *   unauthed     → no session, send to /welcome
 *   pendingOtp   → mid OTP-verification, send to /verify-email
 *   authed       → session valid; profile may be null while fetching.
 *                  RouterGate decides the route from profile.onboarding_completed
 *                  + local OnboardingData.
 */
export type AuthState =
  | { kind: 'loading' }
  | { kind: 'unauthed' }
  | { kind: 'pendingOtp'; email: string }
  | { kind: 'authed'; userId: string; email: string; profile: Profile | null };

// Auth context type
interface AuthContextType {
  // Derived state for RouterGate (the only field that drives routing)
  state: AuthState;
  // State
  user: User | null;
  emailUser: EmailUser | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  authProvider: AuthProvider | null;
  pendingEmail: string | null; // Email awaiting OTP verification

  // Email/Password auth (backend)
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string; existingProvider?: string; noAccount?: boolean }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsOtpVerification?: boolean; existingProvider?: string }>;
  /**
   * Cancel an in-flight OTP verification. Clears pendingEmail and
   * pendingPassword so AuthState transitions out of 'pendingOtp' (back
   * to 'unauthed' if no other session exists). RouterGate will then
   * route the user wherever is appropriate; the verify-email screen's
   * back/change-email handlers call this so the back doesn't loop
   * forever (RouterGate forces /verify-email while pendingOtp holds).
   */
  cancelOtp: () => void;
  verifyOtp: (otp: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: () => Promise<{ success: boolean; error?: string }>;

  // Google auth (Supabase)
  signInWithGoogle: () => Promise<void>;

  // Common
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Hook to use auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [emailUser, setEmailUser] = useState<EmailUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  // True while a SIGNED_IN auth listener cycle is still resolving the
  // profile. Without this, RouterGate sees user-set/profile-null and
  // routes prematurely to a derived onboarding step before flipping
  // again when profile lands. Gated separately from `loading` because
  // signInWithGoogle's `loading=false` finally fires BEFORE the
  // listener's profile-fetch await completes.
  const [signingIn, setSigningIn] = useState(false);
  const [authProvider, setAuthProvider] = useState<AuthProvider | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null); // For auto-login after OTP

  /**
   * Fetch profile from backend API by user ID.
   *
   * Retries TRANSIENT failures (network errors, server errors) up to
   * 2 times with backoff. Does NOT retry on a clean "no profile yet"
   * response (data null without an error) — that's a legitimate state
   * for a brand-new user mid-creation, not something to loop on.
   *
   * Why retries matter: an authed-completed user with a momentary
   * network blip on cold-boot would otherwise return null here, drop
   * AuthState into authed-with-null-profile, and RouterGate would
   * mistakenly route them into onboarding instead of the main app.
   */
  const fetchProfile = useCallback(async (userId: string, accessToken?: string) => {
    const token = accessToken || await getAccessToken();
    if (!token) return null;

    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const { data, error } = await authGet<Profile>(
          `${ENDPOINTS.PROFILES}?id=${userId}`,
          token,
        );
        if (data) {
          setProfile(data);
          /* Seed the practice cache from the freshly-fetched profile.
           * Done here (not in setProfile's render) so cross-device
           * changes propagate as soon as a refetch lands. */
          seedPracticeFromProfile(data as ProfileResponse);
          return data;
        }
        if (error) {
          // Server-side error response — retry transient failures.
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            continue;
          }
          console.log('>>> profile fetch error after retries:', error);
          return null;
        }
        // No data, no error → profile genuinely doesn't exist yet.
        // Don't retry; let the caller (login-using-google, signup flow)
        // handle profile creation.
        console.log('>>> No profile found for userId:', userId);
        return null;
      } catch (err: any) {
        // Thrown — almost always a network failure. Retry.
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        console.error('>>> profile fetch threw after retries:', err?.message || err);
        return null;
      }
    }
    return null;
  }, []);

  /**
   * Fetch profile from backend API (alias using stored session — for email users)
   */
  const fetchProfileByEmail = useCallback(async (_email: string) => {
    const storedSession = await getSession();
    if (!storedSession?.userId || !storedSession?.accessToken) return null;
    return fetchProfile(storedSession.userId, storedSession.accessToken);
  }, [fetchProfile]);

  /**
   * Post-auth navigation is owned by RouterGate (see
   * app/_components/RouterGate.tsx). After SIGNED_IN, this provider
   * just makes sure profile is fetched and state is up-to-date;
   * the gate watches AuthState and routes accordingly. Removing the
   * imperative redirects here was the fix for cross-system races
   * (welcome flash before permissions, boot routing inconsistencies).
   *
   * The previous `checkUserStatus` helper (returning -1/0/1) was deleted —
   * profile.onboarding_completed is now read directly from AuthState.
   */
  const refreshAfterAuth = useCallback(async (currentUser: User, accessToken: string) => {
    console.log('>>> refreshAfterAuth for:', currentUser.email);
    try {
      await fetchProfile(currentUser.id, accessToken);
    } catch (err) {
      console.error('>>> refreshAfterAuth failed:', err);
    }
  }, [fetchProfile]);

  /**
   * Sign in with Native Google Sign-In (in-app popup)
   * iOS requires nonce to be generated and passed to both Google and Supabase
   */
  const signInWithGoogle = useCallback(async () => {
    console.log('=== NATIVE GOOGLE SIGN IN STARTED ===');
    try {
      setLoading(true);

      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log('1. Google Play Services available');

      // On iOS, generate nonce and reconfigure Google Sign-In
      if (Platform.OS === 'ios') {
        console.log('1.5. iOS detected - generating nonce...');
        const { raw, hashed } = await generateNonce();
        currentNonce = raw;

        // Reconfigure with nonce for this sign-in attempt.
        // `nonce` is accepted at runtime by the native module but
        // missing from the SDK's exported ConfigureParams type.
        GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
          iosClientId: GOOGLE_IOS_CLIENT_ID,
          offlineAccess: true,
          scopes: ['profile', 'email'],
          nonce: hashed,
        } as any);
        console.log('1.6. Google Sign-In reconfigured with nonce');
      }

      // Sign in with Google (shows native popup)
      console.log('2. Opening Google Sign-In popup...');
      const response = await GoogleSignin.signIn();
      console.log('3. Google Sign-In response received');

      if (isSuccessResponse(response)) {
        const { idToken } = response.data;
        console.log('4. Got ID token:', idToken ? 'yes' : 'no');

        if (!idToken) {
          throw new Error('No ID token received from Google');
        }

        // Sign in to Supabase with Google ID token
        // On iOS, pass the raw nonce we generated earlier
        console.log('5. Signing in to Supabase with ID token...');
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          ...(Platform.OS === 'ios' && currentNonce && { nonce: currentNonce }),
        });

        // Clear nonce after use
        currentNonce = null;

        if (error) {
          console.error('6. Supabase sign-in error:', error);
          throw error;
        }

        console.log('6. Supabase sign-in successful:', data.user?.email);
        // Navigation will be handled by onAuthStateChange listener
      } else {
        console.log('4. Sign-in was cancelled or failed');
        currentNonce = null;
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      currentNonce = null;

      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            console.log('User cancelled the sign-in');
            break;
          case statusCodes.IN_PROGRESS:
            console.log('Sign-in already in progress');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            console.log('Google Play Services not available');
            break;
          default:
            console.error('Unknown error:', error);
        }
      }

      throw error;
    } finally {
      setLoading(false);
      console.log('=== GOOGLE SIGN IN FINISHED ===');
    }
  }, []);

  /**
   * Sign up with email and password (backend API)
   * After signup, user must verify OTP before they can login
   */
  const signUpWithEmail = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; needsOtpVerification?: boolean; existingProvider?: string }> => {
    console.log('=== EMAIL SIGN UP STARTED ===');
    try {
      setLoading(true);

      const result = await backendSignup(email, password);

      if (!result.success) {
        console.log('>>> Signup failed:', result.error);
        // Pass through existingProvider if present
        return {
          success: false,
          error: result.error,
          existingProvider: result.existingProvider,
        };
      }

      console.log('>>> Signup successful for:', result.email);
      console.log('>>> OTP verification required');

      // Store email and password for OTP verification and auto-login.
      // Setting pendingEmail flips AuthState → 'pendingOtp' and RouterGate
      // routes to /verify-email automatically. No imperative push here.
      setPendingEmail(email);
      setPendingPassword(password);

      return { success: true, needsOtpVerification: true };
    } catch (error: any) {
      console.error('>>> Signup error:', error);
      return { success: false, error: error.message || 'Signup failed' };
    } finally {
      setLoading(false);
      console.log('=== EMAIL SIGN UP FINISHED ===');
    }
  }, []);

  /**
   * Verify OTP after signup
   * After verification, auto-login to get access tokens
   */
  const verifyOtp = useCallback(async (
    otp: string
  ): Promise<{ success: boolean; error?: string }> => {
    console.log('=== OTP VERIFICATION STARTED ===');
    try {
      setLoading(true);

      if (!pendingEmail) {
        return { success: false, error: 'No email pending verification' };
      }

      const result = await backendVerifyOtp(pendingEmail, otp);

      if (!result.success) {
        console.log('>>> OTP verification failed:', result.error);
        return { success: false, error: result.error };
      }

      console.log('>>> OTP verified for:', result.email);

      // Auto-login to get access tokens
      let accessToken: string | undefined;
      let refreshToken: string | undefined;
      let userId = result.userId;

      if (pendingPassword) {
        console.log('>>> Auto-login to get tokens...');
        const loginResult = await backendLogin(pendingEmail, pendingPassword);
        if (loginResult.success && loginResult.accessToken) {
          console.log('>>> Auto-login successful, got tokens');
          accessToken = loginResult.accessToken;
          refreshToken = loginResult.refreshToken;
          userId = loginResult.userId || userId;
        } else {
          console.log('>>> Auto-login failed, continuing without tokens:', loginResult.error);
        }
      }

      // Store pending values before clearing
      const emailToSave = pendingEmail;

      // Save session to local storage (with tokens if available)
      await saveSession(emailToSave, 'email', {
        userId,
        accessToken,
        refreshToken,
      });

      // Hold RouterGate while we transition pendingOtp → authed and
      // fetch the profile. Without this gate, AuthState briefly reads
      // 'authed' with profile=null and RouterGate routes to a derived
      // step before the real profile.onboarding_completed lands.
      setSigningIn(true);
      try {
        // Order of state mutations matters — RouterGate watches AuthState.
        //
        //   1. setEmailUser    — gives us userId/email so 'authed' is valid
        //   2. setAuthProvider — bookkeeping
        //   3. setPendingEmail(null) / setPendingPassword(null)  — flips
        //      AuthState off 'pendingOtp'
        //
        // Doing #3 BEFORE #1 was a race that caused a brief flash to
        // /welcome (transient 'unauthed' state). With this order,
        // AuthState moves directly pendingOtp → authed, no intermediate.
        setEmailUser({ email: emailToSave, userId, provider: 'email' });
        setAuthProvider('email');
        setPendingEmail(null);
        setPendingPassword(null);

        // Fetch the profile so RouterGate can route on truth, not on
        // an empty profile.
        if (userId && accessToken) {
          await fetchProfile(userId, accessToken);
        }
      } finally {
        setSigningIn(false);
      }

      return { success: true };
    } catch (error: any) {
      console.error('>>> OTP verification error:', error);
      return { success: false, error: error.message || 'Verification failed' };
    } finally {
      setLoading(false);
      console.log('=== OTP VERIFICATION FINISHED ===');
    }
  }, [pendingEmail, pendingPassword, fetchProfile]);

  /**
   * Resend OTP to pending email
   */
  const resendOtp = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    console.log('=== RESEND OTP STARTED ===');
    try {
      setLoading(true);

      if (!pendingEmail) {
        return { success: false, error: 'No email pending verification' };
      }

      const result = await backendResendOtp(pendingEmail);

      if (!result.success) {
        console.log('>>> Resend OTP failed:', result.error);
        return { success: false, error: result.error };
      }

      console.log('>>> OTP resent to:', pendingEmail);
      return { success: true };
    } catch (error: any) {
      console.error('>>> Resend OTP error:', error);
      return { success: false, error: error.message || 'Failed to resend OTP' };
    } finally {
      setLoading(false);
      console.log('=== RESEND OTP FINISHED ===');
    }
  }, [pendingEmail]);

  /**
   * Sign in with email and password (backend API)
   */
  const signInWithEmail = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; existingProvider?: string; noAccount?: boolean }> => {
    console.log('=== EMAIL SIGN IN STARTED ===');
    try {
      setLoading(true);

      const result = await backendLogin(email, password);

      if (!result.success) {
        console.log('>>> Login failed:', result.error);
        // Pass through both existingProvider and noAccount so the UI
        // can decide whether to (a) point user at Google, (b) auto-
        // promote to signup, or (c) show "wrong password."
        return {
          success: false,
          error: result.error,
          existingProvider: result.existingProvider,
          noAccount: result.noAccount,
        };
      }

      console.log('>>> Login successful for:', result.email);
      console.log('>>> Got tokens:', result.accessToken ? 'yes' : 'no');

      // Save session to local storage (with tokens)
      await saveSession(email, 'email', {
        userId: result.userId,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      // Hold the routing gate while we transition emailUser → profile.
      // Without this, RouterGate sees user-set/profile-null for a
      // moment and routes prematurely.
      setSigningIn(true);
      try {
        setEmailUser({ email, userId: result.userId, provider: 'email' });
        setAuthProvider('email');
        if (result.userId && result.accessToken) {
          await fetchProfile(result.userId, result.accessToken);
        }
      } finally {
        setSigningIn(false);
      }

      return { success: true };
      // RouterGate consumes the new AuthState and navigates.
    } catch (error: any) {
      console.error('>>> Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    } finally {
      setLoading(false);
      console.log('=== EMAIL SIGN IN FINISHED ===');
    }
  }, [fetchProfile]);

  /**
   * Sign out from all auth providers
   */
  const signOut = useCallback(async () => {
    console.log('=== SIGN OUT STARTED ===');
    try {
      setLoading(true);

      // Get current email for backend logout
      const currentEmail = user?.email || emailUser?.email;

      // Sign out from Google (if applicable)
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore Google sign-out errors
      }

      // Sign out from Supabase (if applicable)
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // Ignore Supabase sign-out errors
      }

      // Clear local session
      await clearSession();

      // Clear onboarding data (fresh start on next login)
      await clearOnboardingData();
      // Clear cached emotional profile so the next user on this
      // device doesn't briefly see the previous user's reading on
      // /analysing or /your-reading.
      await clearEmotionalProfile();

      // Defensive: if a SIGNED_IN handler was mid-flight when signOut
      // landed, signingIn could be left at true and pin AuthState in
      // 'loading'. Reset it here so AuthState lands cleanly on
      // 'unauthed' regardless of in-flight handlers.
      setSigningIn(false);

      /* Flush any pending practice PATCHes BEFORE wiping the cache —
       * otherwise an in-flight optimistic write (heart toggle, stats
       * increment) can never reach the server: clearPracticeCache
       * sets profileId to null and flushField early-returns, dropping
       * the write silently. flushPending() resolves even on failure
       * (retry has run); a 1-2s wait on signOut is acceptable for
       * not-losing-user-actions. */
      try {
        await flushPendingPracticeWrites();
      } catch (err) {
        console.warn('[AuthContext] practice flush before signOut failed (continuing):', err);
      }

      // Clear all state. State transitions to 'unauthed'; RouterGate
      // detects the change and routes to /welcome on next render.
      setUser(null);
      setEmailUser(null);
      setSession(null);
      setProfile(null);
      setAuthProvider(null);
      /* Wipe the practice cache so the next user opening the app
       * doesn't see the previous user's liked-state / hints / stats. */
      clearPracticeCache();

      /* Same reason for Sound Spaces — wipe per-space progress and the
       * liked-spaces set so user A's catalog state doesn't leak into
       * user B's session on a shared device. */
      clearAllSpaceProgress();
      void clearLikedSpaces();
      /* And the profile-tab tunable settings (pronouns / age / voice /
       * memory / check-in times / therapist style). Local cache only —
       * the backend `mello_user_preferences` JSON belongs to the user's
       * row and is fetched fresh on next sign-in. */
      void clearProfilePreferences();
      clearUserMemoryCache();

      console.log('=== SIGN OUT COMPLETE ===');
    } catch (error) {
      console.error('Sign out error:', error);
      // Still clear state even on error — same shape as the success path.
      setSigningIn(false);
      setUser(null);
      setEmailUser(null);
      setSession(null);
      setProfile(null);
      setAuthProvider(null);
      await clearSession();
      await clearOnboardingData();
      await clearEmotionalProfile();
      clearAllSpaceProgress();
      void clearLikedSpaces();
      void clearProfilePreferences();
      clearUserMemoryCache();
    } finally {
      setLoading(false);
    }
  }, [user?.email, emailUser?.email, authProvider]);

  /**
   * Refresh profile data
   */
  const refreshProfile = useCallback(async () => {
    const token = await getAccessToken();
    const storedSession = await getSession();
    const profileId = user?.id || storedSession?.userId;
    if (profileId && token) {
      await fetchProfile(profileId, token);
    }
  }, [user?.id, fetchProfile]);

  /**
   * Mark onboarding as complete.
   *
   * Backend is frozen, so we can't get a server-side transaction. We
   * achieve "no half-states possible" by strict client-side ordering
   * with verified retries:
   *
   *   PHASE 1 — POST /user_onboarding (idempotent on the client side
   *             via retry; if backend returns 409 on duplicate we
   *             treat that as success because the row already exists).
   *             We will NOT proceed to phase 2 unless this confirmed
   *             a row exists.
   *
   *   PHASE 2 — PATCH /profiles SET onboarding_completed=true.
   *             Retried independently. Idempotent (setting true again
   *             is harmless).
   *
   * Failure semantics:
   *   - Phase 1 fails after retries → throw. profile.onboarding_completed
   *     stays false. Local data is preserved (we no longer wipe). User
   *     can retry from the same screen — phase 1 will either succeed or
   *     409 (treated as success), then phase 2 proceeds.
   *   - Phase 2 fails after retries → throw. user_onboarding row exists,
   *     profile.onboarding_completed still false. Next attempt's phase
   *     1 returns 409 (success), phase 2 retries. Eventually consistent.
   *
   * Net invariant: if completeOnboarding ever returns successfully,
   *   - the user_onboarding row exists
   *   - profiles.onboarding_completed === true
   * Both are true. No half-state ships.
   */
  const completeOnboarding = useCallback(async () => {
    const currentEmail = user?.email || emailUser?.email;
    if (!user?.id && !currentEmail) {
      throw new Error('No user to complete onboarding for');
    }

    console.log('>>> Completing onboarding for:', user?.id || currentEmail);

    // ── PHASE 1 — sync answers to user_onboarding ──────────────────
    const { syncOnboardingToBackend } = await import('@/services/onboarding/onboardingApi');
    await retryWithBackoff(
      async () => {
        const result = await syncOnboardingToBackend();
        // Treat duplicate-row response as success — the data is on the
        // server, which is what phase 1 needs to verify. The exact
        // backend response shape varies, so we accept both an explicit
        // success flag and a 409 / "already exists" error message.
        if (result.success) return;
        const msg = (result.error || '').toLowerCase();
        if (msg.includes('409') || msg.includes('duplicate') || msg.includes('already')) {
          console.log('>>> [completeOnboarding] sync: row already exists — proceeding');
          return;
        }
        throw new Error(`user_onboarding sync failed: ${result.error || 'unknown'}`);
      },
      { attempts: 3, baseMs: 600, label: 'user_onboarding sync' },
    );

    // ── PHASE 2 — flip the profile flag ────────────────────────────
    const onboardingData = await getOnboardingData();
    const firstName = onboardingData.firstName?.trim() || null;
    const updatePayload: Record<string, unknown> = { onboarding_completed: true };
    if (firstName) updatePayload.username = firstName;

    /* Seed `mello_user_preferences` from any personalize-page choices
     * the user made earlier in the flow. Today the only personalize
     * field that maps directly to the JSON template is `personalizeTone`
     * → `therapist_style` (the keys are identical: 'soft-slow' /
     * 'clear-direct' / 'bit-playful'). When more profile-tab settings
     * get collected during onboarding, extend this map — keep the
     * mapping inline so the payload stays atomic with the
     * onboarding-completed flag flip. */
    const seededPrefs: Record<string, unknown> = {};
    const tone = onboardingData.personalizeTone;
    if (tone === 'soft-slow' || tone === 'clear-direct' || tone === 'bit-playful') {
      seededPrefs.therapist_style = tone;
    }
    if (Object.keys(seededPrefs).length > 0) {
      seededPrefs.updated_at = new Date().toISOString();
      updatePayload.mello_user_preferences = seededPrefs;
    }

    const accessToken = await getAccessToken();
    const storedSession = await getSession();
    const profileId = user?.id || storedSession?.userId;
    if (!profileId) throw new Error('No profile ID for completeOnboarding');
    if (!accessToken) throw new Error('No access token for completeOnboarding');

    await retryWithBackoff(
      async () => {
        const { error: patchError } = await authPatch(
          ENDPOINTS.PROFILES_UPDATE(profileId),
          updatePayload,
          accessToken,
        );
        if (patchError) {
          throw new Error(`profile PATCH failed: ${patchError.message}`);
        }
      },
      { attempts: 5, baseMs: 500, label: 'profile flag flip' },
    );

    console.log('>>> [completeOnboarding] both phases confirmed; refreshing profile');
    await fetchProfile(profileId, accessToken);
    // RouterGate sees profile.onboarding_completed=true → routes to /chat.
  }, [user?.id, user?.email, emailUser?.email, fetchProfile]);

  /**
   * Initialize auth state listener
   */
  useEffect(() => {
    // Get initial session (check both Supabase and local storage)
    const initializeAuth = async () => {
      console.log('>>> Initializing auth...');

      // First check for Supabase session (Google auth)
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession?.user) {
        console.log('>>> Found Supabase session:', currentSession.user.email);
        setSession(currentSession);
        setUser(currentSession.user);
        setAuthProvider('google');
        await fetchProfile(currentSession.user.id, currentSession.access_token);
        setInitialized(true);
        return;
      }

      // No Supabase session - check for email session in local storage
      const storedSession = await getSession();
      if (storedSession && storedSession.loginStatus) {
        console.log('>>> Found stored email session:', storedSession.email);
        setEmailUser({ email: storedSession.email, userId: storedSession.userId, provider: 'email' });
        setAuthProvider('email');
        if (storedSession.userId && storedSession.accessToken) {
          await fetchProfile(storedSession.userId, storedSession.accessToken);
        }
      } else {
        console.log('>>> No active session found');
      }

      setInitialized(true);
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('>>> Auth state changed:', event, '| User:', currentSession?.user?.email);

        // Mark "settling" BEFORE flipping user state so AuthState
        // reports `loading` instead of `authed-with-null-profile` for
        // the duration of the post-auth profile fetch. RouterGate
        // sits idle until this clears. Without this, RouterGate would
        // route to a derived step the moment setUser fires (~1.7s
        // before login-using-google returns) and we'd see a brief
        // flash to /credibility (or /permissions, or wherever
        // deriveOnboardingStep lands) before the real profile arrives
        // and routes us to the correct destination.
        if (event === 'SIGNED_IN' && currentSession?.user) {
          console.log('[AuthContext] SIGNED_IN listener: setSigningIn(true)');
          setSigningIn(true);
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Handle post-auth navigation on sign in
          if (event === 'SIGNED_IN') {
            try {
              const provider = currentSession.user.app_metadata?.provider as AuthProvider || 'google';
              console.log('>>> Saving session to storage for provider:', provider);
              await saveSession(currentSession.user.email!, provider, {
                userId: currentSession.user.id,
                accessToken: currentSession.access_token,
                refreshToken: currentSession.refresh_token,
              });

              // For Google auth: notify backend to create/upsert profile
              if (provider === 'google') {
                console.log('>>> Calling login-using-google to create profile...');
                const googleRes = await post<{ profile: Profile }>(
                  ENDPOINTS.AUTH_LOGIN_GOOGLE,
                  { access_token: currentSession.access_token }
                );
                if (googleRes.data?.profile) {
                  console.log(
                    '[AuthContext] login-using-google profile received: onboarding_completed =',
                    googleRes.data.profile.onboarding_completed,
                  );
                  setProfile(googleRes.data.profile);
                  /* Seed practice cache on this short-circuit path too —
                   * it bypasses fetchProfile, which is the only other
                   * place we seed. Without this the practice cache stays
                   * at profileId=null for Google users until a manual
                   * refreshProfile, and every PATCH silently drops. */
                  seedPracticeFromProfile(googleRes.data.profile as ProfileResponse);
                  console.log('>>> Google profile created/fetched:', googleRes.data.profile.email_id);
                } else {
                  console.warn('>>> login-using-google returned no profile:', googleRes.error);
                  await fetchProfile(currentSession.user.id, currentSession.access_token);
                }
              } else {
                await fetchProfile(currentSession.user.id, currentSession.access_token);
              }

              console.log('>>> SIGNED_IN handled; RouterGate owns navigation.');
            } finally {
              // Profile is set (or attempted) — release the gate.
              console.log('[AuthContext] SIGNED_IN listener: setSigningIn(false)');
              setSigningIn(false);
            }
          } else {
            await fetchProfile(currentSession.user.id, currentSession.access_token);
          }
        } else {
          // No session — SIGNED_OUT or equivalent. Clear every auth
          // field atomically so AuthState lands on 'unauthed' in the
          // same render cycle. Without this, `emailUser` outlives the
          // SIGNED_OUT event and causes a brief `authed(completed=false)`
          // flash that RouterGate acts on, sending email-auth users to
          // /credibility instead of /welcome on signout.
          console.log('>>> No user in session, clearing profile');
          /* Same flush-before-clear pattern as the explicit signOut
           * path — a SIGNED_OUT event arriving from the server-side
           * Supabase listener can race a just-tapped heart, and we
           * don't want to silently lose the toggle. */
          try {
            await flushPendingPracticeWrites();
          } catch (err) {
            console.warn('[AuthContext] practice flush on no-session failed (continuing):', err);
          }
          setEmailUser(null);
          setProfile(null);
          /* Same reasoning as the signOut path — cache must not
           * outlive the previous session into a different user. */
          clearPracticeCache();
          clearAllSpaceProgress();
          void clearLikedSpaces();
          void clearProfilePreferences();
      clearUserMemoryCache();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ─── Derived AuthState (single source for RouterGate) ──────────────
  //
  // Computed from existing fields. `loading` here is conservative — we
  // wait for `initialized` (auth listener has run at least once) and we
  // also wait while `loading` is true (an auth method is in flight).
  //
  // `authed` includes the case where profile is null (still fetching, or
  // fetch failed). RouterGate treats null profile as "not yet completed"
  // and routes the user into onboarding rather than the main app — safe
  // default; refreshProfile() can recover later.
  const state: AuthState = useMemo(() => {
    if (!initialized) return { kind: 'loading' };
    // Mid-SIGNED_IN: user is set but profile is still being fetched.
    // Hold the gate to prevent premature routing to a derived step.
    if (signingIn) return { kind: 'loading' };
    if (pendingEmail) return { kind: 'pendingOtp', email: pendingEmail };
    if (user) {
      return {
        kind: 'authed',
        userId: user.id,
        email: user.email ?? '',
        profile,
      };
    }
    if (emailUser?.userId) {
      return {
        kind: 'authed',
        userId: emailUser.userId,
        email: emailUser.email,
        profile,
      };
    }
    return { kind: 'unauthed' };
  }, [initialized, signingIn, pendingEmail, user, emailUser, profile]);

  const value: AuthContextType = {
    // Derived state
    state,
    // State
    user,
    emailUser,
    session,
    profile,
    loading,
    initialized,
    authProvider,
    pendingEmail,

    // Email/Password auth
    signInWithEmail,
    signUpWithEmail,
    verifyOtp,
    resendOtp,
    cancelOtp: () => {
      setPendingEmail(null);
      setPendingPassword(null);
    },

    // Google auth
    signInWithGoogle,

    // Common
    signOut,
    refreshProfile,
    completeOnboarding,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
