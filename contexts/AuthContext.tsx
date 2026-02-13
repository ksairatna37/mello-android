/**
 * Auth Context for Mello Android
 *
 * Provides authentication state and methods throughout the app:
 * - Native Google Sign-In (in-app popup)
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
import { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';

// Google Web Client ID - Required for Supabase auth
// Get this from Google Cloud Console -> Credentials -> OAuth 2.0 Client IDs -> Web client
const GOOGLE_WEB_CLIENT_ID = '499732705533-9lmeh4ah0rvbb6f6dirtudmf6gts7avb.apps.googleusercontent.com';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  offlineAccess: true,
  scopes: ['profile', 'email'],
});

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

// Auth context type
interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  signInWithGoogle: () => Promise<void>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();

  /**
   * Fetch user profile from profiles table
   */
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      setProfile(data as Profile);
      return data as Profile;
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
   * Update profile data for new users
   */
  const updateProfileData = useCallback(async (user: User) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          email_id: user.email,
          first_login: false, // Will become true after onboarding
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
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
        console.log('>>> Existing user with complete onboarding, going to main/chat');
        router.replace('/(main)/chat' as any);
      }
    } catch (error) {
      console.error('>>> Error in handlePostAuthNavigation:', error);
      // Fallback to onboarding on error
      router.replace('/(onboarding-new)/name-input' as any);
    }
  }, [checkUserStatus, updateProfileData, router]);

  /**
   * Sign in with Native Google Sign-In (in-app popup)
   */
  const signInWithGoogle = useCallback(async () => {
    console.log('=== NATIVE GOOGLE SIGN IN STARTED ===');
    try {
      setLoading(true);

      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log('1. Google Play Services available');

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
        console.log('5. Signing in to Supabase with ID token...');
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });

        if (error) {
          console.error('6. Supabase sign-in error:', error);
          throw error;
        }

        console.log('6. Supabase sign-in successful:', data.user?.email);
        // Navigation will be handled by onAuthStateChange listener
      } else {
        console.log('4. Sign-in was cancelled or failed');
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);

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
   * Sign out from both Supabase and Google
   */
  const signOut = useCallback(async () => {
    try {
      setLoading(true);

      // Sign out from Google
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore Google sign-out errors
      }

      // Sign out from Supabase
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      // Navigate to welcome screen
      router.replace('/(onboarding)/welcome' as any);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [router]);

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
      router.replace('/(main)/chat' as any);
    } catch (error) {
      console.error('>>> Error completing onboarding:', error);
      throw error;
    }
  }, [user?.id, fetchProfile, router]);

  /**
   * Initialize auth state listener
   */
  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      console.log('>>> Initial session:', currentSession?.user?.email || 'none');
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        console.log('>>> Fetching initial profile...');
        await fetchProfile(currentSession.user.id);
        console.log('>>> Initial profile fetched');
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
    user,
    session,
    profile,
    loading,
    initialized,
    signInWithGoogle,
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
