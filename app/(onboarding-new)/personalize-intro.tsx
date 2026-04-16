/**
 * Personalize Intro Screen
 * Shown once after auth, before the 10-question onboarding flow
 *
 * "Let's personalize Mello for you."
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function PersonalizeIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleContinue = () => {
    router.replace('/(onboarding-new)/questions' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Background Gradient - matches onboarding vibe */}
      <LinearGradient
        colors={['#FAF8F5', '#f5eee5', '#c8e4f5']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>

        {/* Logo */}
        <View style={styles.logoRow}>
          <Text style={styles.logo}>mello</Text>
        </View>

        {/* Center Section */}
        <View style={styles.centerSection}>
          {/* Icon badge */}
          <View style={styles.iconBadge}>
            <Ionicons name="shield-checkmark-outline" size={36} color="#1A1A1A" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Let's personalize{'\n'}Mello for you.</Text>

          {/* Privacy line */}
          <View style={styles.privacyRow}>
            <Ionicons name="lock-closed" size={14} color="#9E9E9E" />
            <Text style={styles.privacyText}>
              Your individual data will not be shared outside Mello.
            </Text>
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  logoRow: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
    fontFamily: 'Playwrite',
    color: '#1A1A1A',
  },
  centerSection: {
    alignItems: 'center',
    gap: 20,
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 44,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  privacyText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#666666',
    flex: 1,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
});
