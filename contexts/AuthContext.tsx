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
  ReactNode,
  useCallback,
} from 'react';
import { Platform } from 'react-native';
import { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
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
  type AuthProvider,
} from '@/services/auth';

// Onboarding storage (for clearing on logout)
import { clearOnboardingData } from '@/utils/onboardingStorage';

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

// INVESTOR DEMO: Redirect to voice instead of chat (chat is disabled)
const DEMO_REDIRECT_TO_VOICE = false;
const DEFAULT_MAIN_ROUTE = DEMO_REDIRECT_TO_VOICE ? '/(main)/call' : '/(main)/chat';

// Profile interface matching the web app
interface Profile {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  email_id?: string | null;
  first_login?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

// Email user (for backend auth - no Supabase User object)
interface EmailUser {
  email: string;
  userId?: string;
  provider: 'email';
}

// Auth context type
interface AuthContextType {
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
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string; existingProvider?: string }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsOtpVerification?: boolean; existingProvider?: string }>;
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
  const [authProvider, setAuthProvider] = useState<AuthProvider | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null); // For auto-login after OTP
  const router = useRouter();

  /**
   * Fetch user profile from profiles table
   * PGRST116 = no rows found (expected for new users)
   */
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Returns null instead of error when no rows

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      if (data) {
        setProfile(data as Profile);
        return data as Profile;
      }

      // No profile yet (new user) - this is expected
      return null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  /**
   * Check user status in profiles table
   * Returns: -1 (new), 0 (incomplete onboarding), 1 (complete)
   */
  const checkUserStatus = useCallback(async (email: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email_id', email.trim())
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          return -1; // Not found
        }
        console.error('Error checking user status:', error);
        return -1;
      }

      if (data) {
        return data.first_login ? 1 : 0;
      }

      return -1; // Not found
    } catch (error) {
      console.error('Error checking user status:', error);
      return -1;
    }
  }, []);

  /**
   * Create or update profile data for new users (UPSERT)
   */
  const updateProfileData = useCallback(async (user: User) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id, // Required for upsert to match existing row
          email_id: user.email,
          first_login: false, // Will become true after onboarding
          username: user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        }, {
          onConflict: 'id', // If id exists, update; otherwise insert
        });

      if (error) {
        console.error('Error upserting profile:', error);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  }, []);

  /**
   * Handle navigation based on user status
   * Status: -1 (new user), 0 (incomplete onboarding), 1 (complete)
   */
  const handlePostAuthNavigation = useCallback(async (currentUser: User) => {
    console.log('>>> handlePostAuthNavigation called for:', currentUser.email);

    if (!currentUser.email) {
      console.error('>>> User has no email, cannot navigate');
      return;
    }

    try {
      const status = await checkUserStatus(currentUser.email);
      console.log('>>> User status:', status, 'for email:', currentUser.email);

      // Small delay to ensure auth state is fully propagated
      await new Promise(resolve => setTimeout(resolve, 300));

      if (status === -1) {
        // New user - update profile and go to onboarding
        console.log('>>> New user, updating profile and going to onboarding');
        await updateProfileData(currentUser);
        router.replace('/(onboarding-new)/name-input' as any);
      } else if (status === 0) {
        // Existing user, incomplete onboarding (first_login: false)
        console.log('>>> Existing user with incomplete onboarding');
        router.replace('/(onboarding-new)/name-input' as any);
      } else {
        // Existing user, completed onboarding (first_login: true)
        console.log('>>> Existing user with complete onboarding, going to main');
        router.replace(DEFAULT_MAIN_ROUTE as any);
      }
    } catch (error) {
      console.error('>>> Error in handlePostAuthNavigation:', error);
      // Fallback to onboarding on error
      router.replace('/(onboarding-new)/name-input' as any);
    }
  }, [checkUserStatus, updateProfileData, router]);

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

        // Reconfigure with nonce for this sign-in attempt
        GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
          iosClientId: GOOGLE_IOS_CLIENT_ID,
          offlineAccess: true,
          scopes: ['profile', 'email'],
          nonce: hashed, // Pass hashed nonce to Google
        });
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

      // Store email and password for OTP verification and auto-login
      setPendingEmail(email);
      setPendingPassword(password);

      // Navigate to OTP verification screen
      router.push('/(onboarding-new)/verify-email' as any);

      return { success: true, needsOtpVerification: true };
    } catch (error: any) {
      console.error('>>> Signup error:', error);
      return { success: false, error: error.message || 'Signup failed' };
    } finally {
      setLoading(false);
      console.log('=== EMAIL SIGN UP FINISHED ===');
    }
  }, [router]);

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

      // Clear pending state
      setPendingEmail(null);
      setPendingPassword(null);

      // Save session to local storage (with tokens if available)
      await saveSession(emailToSave, 'email', {
        userId,
        accessToken,
        refreshToken,
      });

      // Set email user state
      setEmailUser({ email: emailToSave, userId, provider: 'email' });
      setAuthProvider('email');

      // Navigate to onboarding (new user always goes to onboarding)
      await new Promise(resolve => setTimeout(resolve, 300));
      router.replace('/(onboarding-new)/name-input' as any);

      return { success: true };
    } catch (error: any) {
      console.error('>>> OTP verification error:', error);
      return { success: false, error: error.message || 'Verification failed' };
    } finally {
      setLoading(false);
      console.log('=== OTP VERIFICATION FINISHED ===');
    }
  }, [pendingEmail, pendingPassword, router]);

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
  ): Promise<{ success: boolean; error?: string; existingProvider?: string }> => {
    console.log('=== EMAIL SIGN IN STARTED ===');
    try {
      setLoading(true);

      const result = await backendLogin(email, password);

      if (!result.success) {
        console.log('>>> Login failed:', result.error);
        // Pass through existingProvider if present
        return {
          success: false,
          error: result.error,
          existingProvider: result.existingProvider,
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

      // Set email user state
      setEmailUser({ email, userId: result.userId, provider: 'email' });
      setAuthProvider('email');

      // Check user status for navigation
      const status = await checkUserStatus(email);
      console.log('>>> User status:', status);

      await new Promise(resolve => setTimeout(resolve, 300));

      if (status === 1) {
        // Completed onboarding → main app
        router.replace(DEFAULT_MAIN_ROUTE as any);
      } else {
        // New or incomplete → onboarding
        router.replace('/(onboarding-new)/name-input' as any);
      }

      return { success: true };
    } catch (error: any) {
      console.error('>>> Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    } finally {
      setLoading(false);
      console.log('=== EMAIL SIGN IN FINISHED ===');
    }
  }, [router, checkUserStatus]);

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

      // Clear all state
      setUser(null);
      setEmailUser(null);
      setSession(null);
      setProfile(null);
      setAuthProvider(null);

      // Navigate to splash screen (will redirect to welcome)
      router.replace('/');
      console.log('=== SIGN OUT COMPLETE ===');
    } catch (error) {
      console.error('Sign out error:', error);
      // Still clear state even on error
      setUser(null);
      setEmailUser(null);
      setSession(null);
      setProfile(null);
      setAuthProvider(null);
      await clearSession();
      await clearOnboardingData();
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }, [router, user?.email, emailUser?.email, authProvider]);

  /**
   * Refresh profile data
   */
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  /**
   * Mark onboarding as complete and navigate to main app
   */
  const completeOnboarding = useCallback(async () => {
    if (!user?.id) {
      console.error('>>> No user to complete onboarding for');
      return;
    }

    console.log('>>> Completing onboarding for user:', user.id);

    try {
      // Update profile to mark onboarding complete
      const { error } = await supabase
        .from('profiles')
        .update({ first_login: true })
        .eq('id', user.id);

      if (error) {
        console.error('>>> Error updating profile:', error);
        throw error;
      }

      console.log('>>> Onboarding marked complete');

      // Refresh profile to get updated data
      await fetchProfile(user.id);

      // Navigate to main app
      router.replace(DEFAULT_MAIN_ROUTE as any);
    } catch (error) {
      console.error('>>> Error completing onboarding:', error);
      throw error;
    }
  }, [user?.id, fetchProfile, router]);

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
        await fetchProfile(currentSession.user.id);
        setInitialized(true);
        return;
      }

      // No Supabase session - check for email session in local storage
      const storedSession = await getSession();
      if (storedSession && storedSession.loginStatus) {
        console.log('>>> Found stored email session:', storedSession.email);
        setEmailUser({ email: storedSession.email, provider: 'email' });
        setAuthProvider('email');
        // Note: No profile fetch for email users (different backend)
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

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          console.log('>>> Fetching profile for user:', currentSession.user.id);
          await fetchProfile(currentSession.user.id);

          // Handle post-auth navigation on sign in
          if (event === 'SIGNED_IN') {
            console.log('>>> SIGNED_IN event - calling handlePostAuthNavigation');
            await handlePostAuthNavigation(currentSession.user);
          }
        } else {
          console.log('>>> No user in session, clearing profile');
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, handlePostAuthNavigation]);

  const value: AuthContextType = {
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
