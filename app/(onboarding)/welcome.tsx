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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DreamyGradient } from '@/components/common';
import AuthBottomSheet from '@/components/onboarding/AuthBottomSheet';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showAuthSheet, setShowAuthSheet] = useState(false);

  const handleGetStarted = () => {
    // Start onboarding questions — no auth needed yet
    router.replace('/(onboarding-new)/credibility' as any);
  };

  const handleAlreadyHaveAccount = () => {
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
          <Text style={styles.logo}>SelfMind</Text>
          <Text style={styles.tagline}>
            Your AI companion for{'\n'}Mental Wellness
          </Text>
        </View>

        {/* Bottom Buttons */}
        <View style={[styles.buttonSection, { paddingBottom: insets.bottom + 24 }]}>
          {/* Get Started - Black button */}
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={handleGetStarted}
            activeOpacity={0.9}
          >
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </TouchableOpacity>

          {/* I already have an account */}
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleAlreadyHaveAccount}
            activeOpacity={0.7}
          >
            <Text style={styles.signInButtonText}>I already have an account</Text>
          </TouchableOpacity>

          {/* Legal */}
          <Text style={styles.legalText}>
            By continuing you agree to SelfMind's{'\n'}
            <Text style={styles.legalLink} onPress={() => Linking.openURL('https://melloai.health/terms')}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.legalLink} onPress={() => Linking.openURL('https://melloai.health/privacy')}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>

      {/* Auth Bottom Sheet — sign in only for returning users */}
      <AuthBottomSheet
        visible={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
        initialMode="signin"
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
    fontFamily: 'DMSerif',
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
    gap: 10,
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
    fontSize: 17,
    fontFamily: 'Outfit-Medium',
    color: '#FFFFFF',
  },
  signInButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  signInButtonText: {
    fontSize: 17,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },
  legalText: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
});
