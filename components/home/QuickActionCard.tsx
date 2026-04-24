/**
 * QuickActionCard — liquid-glass tile used in the Home 2×2 grid.
 * Each action carries its own ambient gradient so the grid reads as four
 * distinct glass panes, all sharing the same frosted-chip + highlight recipe.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { BorderRadius, Shadows, Spacing } from '@/constants/spacing';

export type QuickActionTone = 'voice' | 'chat' | 'journal' | 'breathe';

interface Props {
  emoji: string;
  label: string;
  sublabel: string;
  tone: QuickActionTone;
  onPress: () => void;
}

const TONE_GRADIENTS: Record<QuickActionTone, readonly [string, string, string]> = {
  // Lavender → soft pink (voice / emotional).
  voice: ['#8A6FC4', '#B498DB', '#F0CFDF'],
  // Periwinkle → sky pastel (conversation / chat).
  chat: ['#7890CC', '#A5BCDE', '#DCE9F5'],
  // Mauve → blush (personal reflection / journal).
  journal: ['#B06E9B', '#D098B1', '#F4D4DD'],
  // Sage → pale mint (breath / calm).
  breathe: ['#6EAA8C', '#9FCDB2', '#D9EEDD'],
};

export default function QuickActionCard({
  emoji,
  label,
  sublabel,
  tone,
  onPress,
}: Props) {
  const gradient = TONE_GRADIENTS[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sublabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <LinearGradient
        colors={[...gradient] as [string, string, string]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.glassChip}>
        <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
        <Text style={styles.emoji}>{emoji}</Text>
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.sublabel} numberOfLines={2}>
          {sublabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: 22,
    overflow: 'hidden',
    padding: Spacing.md,
    minHeight: 148,
    justifyContent: 'space-between',
    ...Shadows.md,
  },
  glassChip: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  emoji: {
    fontSize: 20,
  },
  textBlock: {
    marginTop: Spacing.md,
  },
  label: {
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  sublabel: {
    fontFamily: 'Outfit-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    marginTop: Spacing.xs,
    lineHeight: 15,
  },
});
