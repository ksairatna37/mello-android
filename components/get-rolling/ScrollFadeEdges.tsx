/**
 * ScrollFadeEdges Component
 * Adds subtle gradient fade effects at top and bottom of scroll containers
 * Creates smooth visual transition when content is scrollable
 */

import React from 'react';
import { StyleSheet } from 'react-native';
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
      {/* Top fade - subtle, extends full width */}
      {showTop && (
        <LinearGradient
          colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)']}
          style={[styles.topFade, { height: topFadeHeight }]}
          pointerEvents="none"
        />
      )}

      {/* Bottom fade - subtle, extends full width */}
      {showBottom && (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
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
    left: -24, // Extend beyond content padding
    right: -24,
    zIndex: 10,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: -24, // Extend beyond content padding
    right: -24,
    zIndex: 10,
  },
});

export default ScrollFadeEdges;
