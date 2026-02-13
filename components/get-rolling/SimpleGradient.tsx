/**
 * SimpleGradient Component
 * Lightweight gradient background for Get Rolling flow
 * No animated blobs - just static gradient for performance
 */

import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Color themes for each screen
const THEMES = {
  warmPink: ['#E8D0D8', '#C8A0B8', '#8B6B7B', '#4A3545', '#2D1F2D'],
  deepPurple: ['#C8C0E0', '#9080B8', '#6050A0', '#3A2870', '#1A1535'],
  coolTeal: ['#C0D8D8', '#88B0B0', '#507878', '#304848', '#182828'],
  softLavender: ['#E0D0E8', '#C0A8D0', '#8868A0', '#503868', '#281838'],
  deepIndigo: ['#C0C8E0', '#8090C0', '#5060A0', '#303870', '#181838'],
  darkEmerald: ['#B0D0C8', '#80A898', '#507868', '#304840', '#182820'],
  default: ['#E8D0D8', '#C8A0B8', '#8B6B7B', '#4A3545', '#2D1F2D'],
};

type ThemeName = keyof typeof THEMES;

interface SimpleGradientProps {
  theme?: ThemeName;
}

export default function SimpleGradient({ theme = 'warmPink' }: SimpleGradientProps) {
  const colors = THEMES[theme] || THEMES.warmPink;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={colors}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
