/**
 * Welcome Screen
 * Entry point for the app - beautiful gradient with mello branding
 *
 * Features:
 * - Dreamy animated gradient background with floating blobs & particles
 * - mello logo in Playwrite font
 * - Tagline: "Your AI companion for Mental Wellness"
 * - Two CTAs: "Take a quick tour" and "Get Started"
 * - Auth bottom sheet slides up on "Get Started"
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DreamyGradient } from '@/components/common';
import AuthBottomSheet from '@/components/onboarding/AuthBottomSheet';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showAuthSheet, setShowAuthSheet] = useState(false);

  const handleTakeTour = () => {
    router.push('/(onboarding)/tour');
  };

  const handleGetStarted = () => {
    // Show auth bottom sheet
    setShowAuthSheet(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Dreamy Animated Gradient Background */}
      <DreamyGradient />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {/* Centered Logo Section */}
        <View style={styles.logoSection}>
          <Text style={styles.logo}>mello</Text>
          <Text style={styles.tagline}>
            Your AI companion for{'\n'}Mental Wellness
          </Text>
        </View>

        {/* Bottom Buttons */}
        <View style={[styles.buttonSection, { paddingBottom: insets.bottom + 24 }]}>
          {/* Take a quick tour - White button */}
          <TouchableOpacity
            style={styles.tourButton}
            onPress={handleTakeTour}
            activeOpacity={0.9}
          >
            <Text style={styles.tourButtonText}>Take a quick tour</Text>
          </TouchableOpacity>

          {/* Get Started - Black button */}
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={handleGetStarted}
            activeOpacity={0.9}
          >
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Auth Bottom Sheet */}
      <AuthBottomSheet
        visible={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 64,
    fontFamily: 'Playwrite',
    color: '#FFFFFF',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 22,
    fontFamily: 'Outfit-Medium',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonSection: {
    gap: 12,
  },
  tourButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tourButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
  getStartedButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  getStartedButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
});
