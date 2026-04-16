/**
 * Mello Entry Point
 * Handles initial routing based on auth state
 *
 * Flow:
 * - Not logged in → Welcome screen
 * - Logged in + completed onboarding → Main chat
 * - Logged in + incomplete onboarding → Resume onboarding
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentStep } from '@/utils/onboardingStorage';

// DEV MODE: Set to true to skip onboarding and go directly to Get Rolling
const DEV_SKIP_TO_GET_ROLLING = false;

// INVESTOR DEMO: Redirect to voice instead of chat (chat is disabled)
const DEMO_REDIRECT_TO_VOICE = false;
const DEFAULT_MAIN_ROUTE = DEMO_REDIRECT_TO_VOICE ? '/(main)/call' : '/(main)/chat';

export default function Index() {
  const { user, emailUser, profile, initialized, loading } = useAuth();
  const [destination, setDestination] = useState<string | null>(null);

  // Check if user is authenticated (either Supabase or backend email auth)
  const isAuthenticated = !!user || !!emailUser;
  const userEmail = user?.email || emailUser?.email;

  useEffect(() => {
    const determineDestination = async () => {
      // DEV: Skip directly to Get Rolling for testing
      if (DEV_SKIP_TO_GET_ROLLING) {
        setDestination(DEFAULT_MAIN_ROUTE);
        return;
      }

      // Wait for auth to initialize
      if (!initialized || loading) {
        return;
      }

      console.log('>>> Index: Auth initialized');
      console.log('>>> Index: User:', userEmail);
      console.log('>>> Index: isAuthenticated:', isAuthenticated);
      console.log('>>> Index: Profile:', profile);

      if (!isAuthenticated) {
        // Not logged in → go to welcome
        console.log('>>> Index: No user, going to welcome');
        setDestination('/(onboarding)/welcome');
      } else if (profile?.first_login === true) {
        // Logged in + completed onboarding → go to main
        console.log('>>> Index: User completed onboarding, going to main');
        setDestination(DEFAULT_MAIN_ROUTE);
      } else {
        // Logged in but:
        // - profile is null (new user, no profile row yet), OR
        // - profile.first_login is false (onboarding incomplete)
        // → resume onboarding from saved step or start from beginning
        console.log('>>> Index: User needs to complete onboarding (profile:', profile, ')');

        // Check if there's a saved step to resume from
        const savedStep = await getCurrentStep();
        if (savedStep) {
          console.log('>>> Index: Resuming from saved step:', savedStep);
          if (savedStep.startsWith('get-rolling/')) {
            // Resume in get-rolling flow
            const screenName = savedStep.replace('get-rolling/', '');
            setDestination(`/(get-rolling)/${screenName}`);
          } else if (savedStep === 'name-input') {
            // 'name-input' was the old onboarding entry point — now questions come first.
            // Treat it as a fresh start through the new flow.
            setDestination('/(onboarding-new)/personalize-intro');
          } else {
            // Resume in onboarding flow
            setDestination(`/(onboarding-new)/${savedStep}`);
          }
        } else {
          console.log('>>> Index: Starting onboarding from beginning');
          setDestination('/(onboarding-new)/personalize-intro');
        }
      }
    };

    determineDestination();
  }, [initialized, loading, isAuthenticated, userEmail, profile]);

  // Show loading while determining destination
  if (!destination) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return <Redirect href={destination as any} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
  },
});
