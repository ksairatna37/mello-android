/**
 * Mello Entry Point — routing logic
 *
 * New onboarding-first flow:
 *
 * No session
 *   └─ no local answers   → welcome (fresh start)
 *   └─ local answers, saw share-result → save-profile (auth gate)
 *   └─ local answers, mid-flow         → resume at saved step
 *
 * Has session
 *   └─ onboarding_completed = true  → main app
 *   └─ onboarding_completed = false
 *         └─ local answers → welcome-aboard (sync + complete)
 *         └─ no local data → credibility (fresh start)
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getOnboardingData, getCurrentStep } from '@/utils/onboardingStorage';

const DEFAULT_MAIN_ROUTE = '/(main)/chat';

export default function Index() {
  const { user, emailUser, profile, initialized, loading } = useAuth();
  const [destination, setDestination] = useState<string | null>(null);

  const isAuthenticated = !!user || !!emailUser;
  const userEmail = user?.email || emailUser?.email;

  useEffect(() => {
    const determineDestination = async () => {
      if (!initialized || loading) return;

      console.log('>>> Index: initialized | user:', userEmail, '| authenticated:', isAuthenticated);
      console.log('>>> Index: profile:', profile);

      if (!isAuthenticated) {
        // Check for local onboarding progress (pre-auth flow)
        const data = await getOnboardingData();
        const savedStep = await getCurrentStep();
        const hasAnswers = !!data.moodWeather;

        console.log('>>> Index: no session | hasAnswers:', hasAnswers, '| savedStep:', savedStep);

        if (!hasAnswers) {
          // Completely fresh — show welcome
          setDestination('/(onboarding)/welcome');
        } else if (savedStep === 'share-result') {
          // Saw their results, just need to create account
          setDestination('/(onboarding-new)/save-profile');
        } else if (savedStep) {
          // Mid-onboarding — resume at saved step
          setDestination(`/(onboarding-new)/${savedStep}`);
        } else {
          // Has some data but no step saved — restart questions
          setDestination('/(onboarding-new)/questions');
        }
        return;
      }

      // Authenticated user
      if (profile?.onboarding_completed === true) {
        console.log('>>> Index: onboarding complete → main app');
        setDestination(DEFAULT_MAIN_ROUTE);
      } else {
        // Onboarding incomplete — check for local answers
        const data = await getOnboardingData();
        const hasAnswers = !!data.moodWeather;
        console.log('>>> Index: onboarding incomplete | hasLocalAnswers:', hasAnswers);
        if (hasAnswers) {
          setDestination('/(onboarding-new)/welcome-aboard');
        } else {
          setDestination('/(onboarding-new)/credibility');
        }
      }
    };

    determineDestination();
  }, [initialized, loading, isAuthenticated, userEmail, profile]);

  if (!destination) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#8B7EF8" />
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
    backgroundColor: '#F2F0FF',
  },
});
