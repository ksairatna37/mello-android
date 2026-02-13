/**
 * OAuth Callback Handler
 * Handles deep link redirects from Google OAuth
 * Route: mello://auth/callback
 *
 * Note: The actual token parsing is done in _layout.tsx via Linking.addEventListener
 * This screen just shows a loading state while auth completes.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    console.log('>>> Callback screen mounted, user:', user?.email, 'loading:', loading);

    // If user is already signed in, the AuthContext will handle navigation
    // Just wait for it to complete
    if (user && !loading) {
      console.log('>>> User already signed in, AuthContext will navigate');
      return;
    }

    // Set a timeout to show error if auth doesn't complete
    const timeout = setTimeout(() => {
      console.log('>>> Auth timeout reached');
      setTimeoutReached(true);
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [user, loading]);

  // If timeout reached and still no user, show error and redirect
  useEffect(() => {
    if (timeoutReached && !user) {
      console.log('>>> No user after timeout, redirecting to welcome');
      setTimeout(() => {
        router.replace('/(onboarding)/welcome');
      }, 2000);
    }
  }, [timeoutReached, user]);

  // Show error if timeout reached with no user
  if (timeoutReached && !user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Authentication Error</Text>
        <Text style={styles.errorText}>
          Sign in took too long. Please try again.
        </Text>
        <Text style={styles.redirectText}>Redirecting back...</Text>
      </View>
    );
  }

  // Default: show loading while auth completes
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Completing sign in...</Text>
      <Text style={styles.subText}>Please wait...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#666',
  },
  errorTitle: {
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
    color: '#E53935',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  redirectText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#999',
  },
});
