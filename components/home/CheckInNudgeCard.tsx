/**
 * CheckInNudgeCard Component - Light Theme
 * Soft lavender card for check-in nudge or streak display
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';

interface CheckInNudgeCardProps {
  hasCheckedIn: boolean;
  streakCount: number;
  onStartCheckIn: () => void;
  onSkip: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const TIMING = { duration: 150, easing: Easing.out(Easing.ease) };

export default function CheckInNudgeCard({
  hasCheckedIn,
  streakCount,
  onStartCheckIn,
  onSkip,
}: CheckInNudgeCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Streak display (checked in + streak >= 3)
  if (hasCheckedIn && streakCount >= 3) {
    return (
      <View style={styles.streakCard}>
        <View style={styles.streakRow}>
          <Text style={styles.fireEmoji}>🔥</Text>
          <Text style={styles.streakText}>
            {streakCount}-day check-in streak! Keep going!
          </Text>
        </View>
      </View>
    );
  }

  // Already checked in, streak < 3 → hide
  if (hasCheckedIn) return null;

  // Not checked in → nudge
  return (
    <Animated.View style={[styles.nudgeCard, animatedStyle]}>
      <View style={styles.nudgeHeader}>
        <Ionicons name="sunny" size={18} color={LIGHT_THEME.accent} />
        <Text style={styles.nudgeTitle}>TODAY'S CHECK-IN</Text>
      </View>
      <Text style={styles.nudgeText}>
        You haven't checked in today.{'\n'}Take 2 minutes to reflect?
      </Text>
      <View style={styles.buttonRow}>
        <AnimatedPressable
          style={styles.primaryButton}
          onPress={onStartCheckIn}
          onPressIn={() => {
            scale.value = withTiming(0.97, TIMING);
          }}
          onPressOut={() => {
            scale.value = withTiming(1, TIMING);
          }}
        >
          <Text style={styles.primaryButtonText}>Start Check-in</Text>
          <Ionicons name="arrow-forward" size={16} color={LIGHT_THEME.textInverse} />
        </AnimatedPressable>
        <Pressable style={styles.ghostButton} onPress={onSkip}>
          <Text style={styles.ghostButtonText}>Skip today</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Streak variant
  streakCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 20,
    padding: 16,
    ...CARD_SHADOW,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fireEmoji: {
    fontSize: 22,
  },
  streakText: {
    fontSize: 15,
    fontFamily: 'Outfit-Medium',
    color: '#8B6914',
    flex: 1,
  },

  // Nudge variant
  nudgeCard: {
    backgroundColor: LIGHT_THEME.accentLight,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    ...CARD_SHADOW,
  },
  nudgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nudgeTitle: {
    fontSize: 12,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nudgeText: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LIGHT_THEME.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textInverse,
  },
  ghostButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ghostButtonText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
  },
});
