/**
 * LightGradient Component
 * Soft pastel background for light theme screens
 *
 * Variants:
 * - default/warm/cool: Simple linear gradient (fastest)
 * - aurora: Subtle aurora effect with soft blobs (still optimized)
 */

import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import SubtleAuroraGradient from './SubtleAuroraGradient';

interface LightGradientProps {
  variant?: 'default' | 'warm' | 'cool' | 'aurora';
}

const LightGradient = memo(({ variant = 'default' }: LightGradientProps) => {
  // Aurora variant uses the subtle aurora effect
  if (variant === 'aurora') {
    return <SubtleAuroraGradient />;
  }

  // Simple linear gradients for other variants
  const colorSets = {
    default: ['#f8f7ff', '#f5f4fa', '#f0eef8'],
    warm: ['#fdfcfa', '#faf8f5', '#f8f5f0'],
    cool: ['#f5f8ff', '#f0f5fa', '#eef2f8'],
  };

  const colors = colorSets[variant] as [string, string, ...string[]];

  return (
    <LinearGradient
      colors={colors}
      style={StyleSheet.absoluteFill}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    />
  );
});

LightGradient.displayName = 'LightGradient';

export default LightGradient;

// Light theme color constants for consistency
export const LIGHT_THEME = {
  // Backgrounds
  background: '#f5f4fa',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',

  // Text
  textPrimary: '#1a1625',
  textSecondary: '#6b6b7b',
  textMuted: '#9999a8',
  textInverse: '#ffffff',

  // Borders & Shadows
  border: '#e8e6f0',
  borderLight: '#f0eef5',
  shadowColor: '#1a1625',

  // Accent colors
  accent: '#b9a6ff',
  accentLight: '#e8e0ff',

  // Mood face colors (pastel)
  moodGreat: '#F5DEB3',   // Beige/tan
  moodGood: '#FFCC80',    // Orange/peach
  moodOkay: '#CE93D8',    // Purple/lavender
  moodLow: '#80CBC4',     // Teal/mint
  moodRough: '#F48FB1',   // Pink/coral

  // Activity card colors
  cardYellow: '#FFF6D9',
  cardPink: '#FFE4E8',
  cardPurple: '#E8DAFF',
  cardMint: '#D4F5E9',
  cardPeach: '#FFE8D9',
  cardBlue: '#D9EEFF',
};

// Shadow presets for cards
export const CARD_SHADOW = {
  shadowColor: LIGHT_THEME.shadowColor,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

export const CARD_SHADOW_LIGHT = {
  shadowColor: LIGHT_THEME.shadowColor,
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 2,
};
