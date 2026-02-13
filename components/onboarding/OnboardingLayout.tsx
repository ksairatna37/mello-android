/**
 * Onboarding Layout Component
 * Shared layout for all new onboarding screens with:
 * - mello logo
 * - Progress bar
 * - Back/Next navigation buttons
 * - Help text
 * - Progressive fade zone above footer (content sinks into calm)
 */

import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOTAL_STEPS = 8; // Total onboarding steps
const FADE_ZONE_HEIGHT = 160; // Height of the progressive fade zone

interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: number;
  onBack?: () => void;
  onNext?: () => void;
  canGoBack?: boolean;
  canGoNext?: boolean;
  showHelp?: boolean;
  helpEmail?: string;
  customHelpText?: string; // Custom text to show instead of email help
  showFadeZone?: boolean; // Enable the progressive fade effect
  showFooter?: boolean; // Show/hide the bottom navigation footer
}

export default function OnboardingLayout({
  children,
  currentStep,
  onBack,
  onNext,
  canGoBack = true,
  canGoNext = false,
  showHelp = true,
  helpEmail = 'support@melloai.health',
  customHelpText,
  showFadeZone = true,
  showFooter = true,
}: OnboardingLayoutProps) {
  const insets = useSafeAreaInsets();

  const handleEmailPress = () => {
    Linking.openURL(`mailto:${helpEmail}`);
  };

  const progressWidth = (currentStep / TOTAL_STEPS) * 100;
  const footerHeight = 56 + 32 + insets.bottom; // nav button + padding + safe area

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Background Gradient */}
      <LinearGradient
        colors={['#FAF8F5', '#f5eee5', '#c8e4f5']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        {/* Header with Logo */}
        <View style={styles.header}>
          <Text style={styles.logo}>mello</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressWidth}%` }]} />
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {children}
        </View>
      </View>

      {/* Progressive Fade Zone - "Content sinks into calm" */}
      {showFadeZone && (
        <View style={[styles.fadeZoneContainer, { bottom: footerHeight - 16 }]} pointerEvents="none">
          {/* Multi-layer gradient for smooth progressive fade */}
          <LinearGradient
            colors={[
              'transparent',
              'rgba(200, 228, 245, 0.2)',
              'rgba(200, 228, 245, 0.4)',
              'rgba(200, 228, 245, 0.7)',
              'rgba(200, 228, 245, 0.9)',
              '#c8e4f5',
            ]}
            locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            style={styles.fadeGradient}
          />
        </View>
      )}

      {/* Footer Navigation - Floating above content */}
      {showFooter && (
        <View
          style={[
            styles.footerWrapper,
            { paddingBottom: insets.bottom + 16 }
          ]}
        >
          {/* Solid background for footer - no content shows through */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#c8e4f5' }]} />

          <View style={styles.footer}>
            {/* Back Button */}
            <TouchableOpacity
              style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
              onPress={onBack}
              disabled={!canGoBack}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={canGoBack ? '#1A1A1A' : '#CCC'}
              />
            </TouchableOpacity>

            {/* Help Text */}
            {showHelp && (
              <View style={styles.helpContainer}>
                {customHelpText ? (
                  <Text style={styles.customHelpText}>{customHelpText}</Text>
                ) : (
                  <>
                    <Text style={styles.helpText}>Experiencing issues? Email our team:</Text>
                    <TouchableOpacity onPress={handleEmailPress}>
                      <Text style={styles.helpEmail}>{helpEmail}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* Next Button */}
            <TouchableOpacity
              style={[
                styles.navButton,
                canGoNext ? styles.navButtonActive : styles.navButtonDisabled
              ]}
              onPress={onNext}
              disabled={!canGoNext}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-forward"
                size={24}
                color={canGoNext ? '#FFFFFF' : '#CCC'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    fontSize: 32,
    fontFamily: 'Playwrite',
    color: '#1A1A1A',
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E8E4E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  mainContent: {
    flex: 1,
  },
  // Progressive fade zone styles
  fadeZoneContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: FADE_ZONE_HEIGHT,
  },
  fadeGradient: {
    flex: 1,
  },
  // Footer styles - floating above content
  footerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 237, 232, 0.9)',
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(240, 237, 232, 0.9)',
  },
  navButtonActive: {
    backgroundColor: '#1A1A1A',
  },
  helpContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  helpText: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: '#888',
    textAlign: 'center',
  },
  helpEmail: {
    fontSize: 13,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
  customHelpText: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: '#555',
    textAlign: 'center',
  },
});
