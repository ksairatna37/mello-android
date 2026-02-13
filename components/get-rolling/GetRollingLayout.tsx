/**
 * GetRollingLayout Component
 * Shared layout for Get Rolling flow screens
 * Features: Aurora gradient, progress header, title section, next button
 */

import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Vibration,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import AuroraGradient, { AuroraTheme } from '@/components/common/AuroraGradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 6;

// Progress bar fill colors for each theme (darker tone of the gradient)
const PROGRESS_COLORS: Record<AuroraTheme, string> = {
  default: '#4A2838',
  warmPink: '#6B3B4A',
  deepPurple: '#3A2060',
  coolTeal: '#2A4848',
  softLavender: '#4A3060',
  deepIndigo: '#282858',
  darkEmerald: '#204838',
};

interface GetRollingLayoutProps {
  children: ReactNode;
  theme: AuroraTheme;
  currentStep: number;
  title: string;
  subtitle?: string;
  privacyText?: string;
  onClose?: () => void;
  onNext?: () => void;
  canContinue?: boolean;
}

export default function GetRollingLayout({
  children,
  theme,
  currentStep,
  title,
  subtitle,
  privacyText,
  onClose,
  onNext,
  canContinue = true,
}: GetRollingLayoutProps) {

  const insets = useSafeAreaInsets();
  const progressWidth = (currentStep / TOTAL_STEPS) * 100;
  const progressColor = PROGRESS_COLORS[theme];

  const handleNext = () => {
    if (canContinue && onNext) {
      Vibration.vibrate(Platform.OS === 'ios' ? 10 : 50);
      onNext();
    }
  };

  const handleClose = () => {
    if (onClose) {
      Vibration.vibrate(Platform.OS === 'ios' ? 10 : 50);
      onClose();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Aurora Gradient Background */}
      <AuroraGradient />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
        {/* Header: Close | Progress Bar | Step */}
        <View style={styles.header}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressWidth}%`, backgroundColor: progressColor },
                ]}
              />
            </View>
          </View>

          {/* Step Indicator */}
          <Text style={styles.stepText}>
            {currentStep} <Text style={styles.stepTextLight}>of {TOTAL_STEPS}</Text>
          </Text>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          {subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
          <Text style={styles.title}>{title}</Text>
          {privacyText && (
            <View style={styles.privacyRow}>
              <Ionicons name="lock-closed" size={14} color="rgba(255, 255, 255, 0.5)" />
              <Text style={styles.privacyText}>{privacyText}</Text>
            </View>
          )}
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {children}
        </View>

        {/* Bottom Section - Next Button */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              !canContinue && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            activeOpacity={0.85}
            disabled={!canContinue}
          >
            <Ionicons
              name="arrow-forward"
              size={24}
              color={canContinue ? '#1A1A1A' : 'rgba(26, 26, 26, 0.4)'}
            />
          </TouchableOpacity>
        </View>
      </View>
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
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  progressContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepText: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    minWidth: 50,
    textAlign: 'right',
  },
  stepTextLight: {
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  // Title Section
  titleSection: {
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    lineHeight: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
    marginBottom: 16,
    lineHeight: 40,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 20,
  },
  // Main Content
  mainContent: {
    flex: 1,
    justifyContent: 'center',
  },
  // Bottom Section
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  nextButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});
