/**
 * ScrollFadeEdges Component
 * Adds gradient fade effects at top and bottom of scroll containers
 * Creates smooth visual transition when content is scrollable
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ScrollFadeEdgesProps {
  topFadeHeight?: number;
  bottomFadeHeight?: number;
  showTop?: boolean;
  showBottom?: boolean;
}

export const ScrollFadeEdges = ({
  topFadeHeight = 40,
  bottomFadeHeight = 80,
  showTop = true,
  showBottom = true,
}: ScrollFadeEdgesProps) => {
  return (
    <>
      {/* Top fade */}
      {showTop && (
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
          style={[styles.topFade, { height: topFadeHeight }]}
          pointerEvents="none"
        />
      )}

      {/* Bottom fade */}
      {showBottom && (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
          style={[styles.bottomFade, { height: bottomFadeHeight }]}
          pointerEvents="none"
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});

export default ScrollFadeEdges;
