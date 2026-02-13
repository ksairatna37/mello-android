/**
 * GradientBackground Component
 * Fallback gradient using View layers when native LinearGradient isn't available
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GradientBackgroundProps {
  colors?: string[];
  style?: any;
}

export default function GradientBackground({
  colors = ['#7EECD3', '#8CF5B8', '#A8F59E', '#C5F57A', '#E8F0A0'],
  style
}: GradientBackgroundProps) {
  // Create layered gradient effect using overlapping views
  return (
    <View style={[styles.container, style]}>
      {/* Base layer - bottom color */}
      <View style={[styles.layer, { backgroundColor: colors[colors.length - 1] }]} />

      {/* Middle layers with opacity */}
      {colors.slice(0, -1).reverse().map((color, index) => (
        <View
          key={index}
          style={[
            styles.layer,
            {
              backgroundColor: color,
              opacity: 1 - (index * 0.2),
              top: `${index * 15}%`,
            },
          ]}
        />
      ))}

      {/* Radial overlay for depth */}
      <View style={styles.radialOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  radialOverlay: {
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    width: SCREEN_WIDTH * 2,
    height: SCREEN_HEIGHT,
    borderRadius: SCREEN_WIDTH,
    backgroundColor: 'rgba(126, 236, 211, 0.3)',
  },
});
