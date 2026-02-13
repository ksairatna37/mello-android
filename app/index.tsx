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

// DEV MODE: Set to true to skip onboarding and go directly to Get Rolling
const DEV_SKIP_TO_GET_ROLLING = true;

export default function Index() {
  const { user, profile, initialized, loading } = useAuth();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    // DEV: Skip directly to Get Rolling for testing
    if (DEV_SKIP_TO_GET_ROLLING) {
      setDestination('/(get-rolling)/age');
      return;
    }

    // Wait for auth to initialize
    if (!initialized || loading) {
      return;
    }

    console.log('>>> Index: Auth initialized');
    console.log('>>> Index: User:', user?.email);
    console.log('>>> Index: Profile:', profile);

    if (!user) {
      // Not logged in → go to welcome
      console.log('>>> Index: No user, going to welcome');
      setDestination('/(onboarding)/welcome');
    } else if (profile === null) {
      // Profile still loading, wait for it
      console.log('>>> Index: Waiting for profile to load...');
      return;
    } else if (profile?.first_login === true) {
      // Logged in + completed onboarding → go to main
      console.log('>>> Index: User completed onboarding, going to main');
      setDestination('/(main)/chat');
    } else {
      // Logged in but onboarding incomplete → resume onboarding
      // For now, start from name-input (after email verification)
      console.log('>>> Index: User needs to complete onboarding');
      setDestination('/(onboarding-new)/name-input');
    }
  }, [initialized, loading, user, profile]);

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
