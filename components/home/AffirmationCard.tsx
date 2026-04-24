/**
 * AffirmationCard — liquid-glass daily affirmation card.
 * Visual language cloned from the reference mockups: deep multi-stop gradient,
 * frosted-glass chip at the top, soft divider, serif quote body, and a
 * matching glass refresh button.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

import { BorderRadius, Shadows, Spacing } from '@/constants/spacing';

interface Props {
  quote: string;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
}

const CARD_GRADIENT = ['#8A6FC4', '#B498DB', '#F0CFDF'] as const;

export default function AffirmationCard({ quote, onRefresh, refreshing }: Props) {
  const rotation = useSharedValue(0);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;
    rotation.value = withTiming(rotation.value + 360, {
      duration: 600,
      easing: Easing.inOut(Easing.cubic),
    });
    await onRefresh();
  }, [onRefresh, refreshing, rotation]);

  return (
    <View style={styles.cardWrap}>
      {/* Base gradient */}
      <LinearGradient
        colors={[...CARD_GRADIENT] as [string, string, string]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top-edge glass highlight */}
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.35 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.content}>
        {/* Glass chip header */}
        <View style={styles.glassPill}>
          <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.glassPillInner}>
            <Text style={styles.pillEmoji}>💜</Text>
            <Text style={styles.pillLabel}>Today</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text
          accessibilityRole="text"
          accessibilityLabel={`Daily affirmation. ${quote}`}
          style={styles.quote}
        >
          {quote}
        </Text>
      </View>

      {onRefresh && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh affirmation"
          accessibilityState={{ busy: !!refreshing }}
          onPress={handleRefresh}
          disabled={refreshing}
          hitSlop={10}
          style={({ pressed }) => [
            styles.refreshWrap,
            pressed && { opacity: 0.7 },
            refreshing && { opacity: 0.55 },
          ]}
        >
          <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
          <Animated.View style={iconStyle}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    borderRadius: 28,
    overflow: 'hidden',
    minHeight: 240,
    ...Shadows.lg,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg + Spacing.sm,
    alignItems: 'center',
  },
  glassPill: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  glassPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillEmoji: {
    fontSize: 13,
  },
  pillLabel: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  divider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quote: {
    fontFamily: 'DMSerif',
    fontSize: 22,
    lineHeight: 30,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: Spacing.xs,
  },
  refreshWrap: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
