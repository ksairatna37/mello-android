/**
 * EmotionalBatteryBlock — liquid-glass greeting card.
 * Deep Mello gradient + frosted chips for streak / journal state.
 * Battery percentage is computed from real user history; when the user hasn't
 * checked in yet we show a gentle CTA instead of a fabricated value.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { BorderRadius, Shadows, Spacing } from '@/constants/spacing';

interface Props {
  battery: number | null;
  streak: number;
  journaledToday: boolean;
  onCheckInPress?: () => void;
}

const CARD_GRADIENT = ['#8A6FC4', '#B498DB', '#F0CFDF'] as const;

export default function EmotionalBatteryBlock({
  battery,
  streak,
  journaledToday,
  onCheckInPress,
}: Props) {
  const fillProgress = useSharedValue(0);

  useEffect(() => {
    if (battery === null) {
      fillProgress.value = withTiming(0, { duration: 300 });
      return;
    }
    fillProgress.value = withDelay(
      500,
      withTiming(battery / 100, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [battery, fillProgress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillProgress.value * 100}%`,
  }));

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[...CARD_GRADIENT] as [string, string, string]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.content}>
        <Text style={styles.label}>Your emotional battery</Text>

        {battery === null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check in to see your emotional battery"
            onPress={onCheckInPress}
            style={({ pressed }) => [styles.ctaRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.ctaText}>Tap to check in →</Text>
          </Pressable>
        ) : (
          <>
            <View
              accessibilityRole="text"
              accessibilityLabel={`Emotional battery ${battery} percent`}
              style={styles.row}
            >
              <Text style={styles.rowLabel}>🔋 Current level</Text>
              <Text style={styles.rowPct}>{battery}%</Text>
            </View>
            <View style={styles.track}>
              <Animated.View style={[styles.fillShell, fillStyle]} />
            </View>
          </>
        )}

        <View style={styles.chipRow}>
          {streak > 0 && (
            <GlassChip text={`🔥 ${streak} day streak`} />
          )}
          {journaledToday ? (
            <GlassChip text="✓ Journaled today" tint="success" />
          ) : (
            <GlassChip text="Journal today →" />
          )}
        </View>
      </View>
    </View>
  );
}

interface GlassChipProps {
  text: string;
  tint?: 'default' | 'success';
}

function GlassChip({ text, tint = 'default' }: GlassChipProps) {
  return (
    <View
      style={[
        styles.chip,
        tint === 'success' && styles.chipSuccess,
      ]}
    >
      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  content: {
    padding: Spacing.cardPadding + 2,
  },
  label: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: Spacing.sm + Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  rowLabel: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  rowPct: {
    fontFamily: 'Outfit-ExtraBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  track: {
    height: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  fillShell: {
    height: '100%',
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
  },
  ctaRow: {
    paddingVertical: Spacing.sm,
  },
  ctaText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  chip: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  chipSuccess: {
    backgroundColor: 'rgba(168, 245, 158, 0.28)',
    borderColor: 'rgba(200, 255, 200, 0.55)',
  },
  chipText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },
});
