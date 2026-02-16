/**
 * ScrollFadeEdges Component
 * Creates smooth content fade effect at scroll edges
 * Like the reference app - content fades to transparent, background shows through
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
  topFadeHeight = 60,
  bottomFadeHeight = 100,
  showTop = true,
  showBottom = true,
}: ScrollFadeEdgesProps) => {
  return (
    <>
      {/* Top fade - soft transparent gradient */}
      {showTop && (
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.15)',
            'rgba(0,0,0,0.08)',
            'rgba(0,0,0,0.02)',
            'transparent',
          ]}
          locations={[0, 0.3, 0.6, 1]}
          style={[styles.topFade, { height: topFadeHeight }]}
          pointerEvents="none"
        />
      )}

      {/* Bottom fade - soft transparent gradient */}
      {showBottom && (
        <LinearGradient
          colors={[
            'transparent',
            'rgba(0,0,0,0.02)',
            'rgba(0,0,0,0.08)',
            'rgba(0,0,0,0.2)',
          ]}
          locations={[0, 0.4, 0.7, 1]}
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
    left: -24,
    right: -24,
    zIndex: 10,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: -24,
    right: -24,
    zIndex: 10,
  },
});

export default ScrollFadeEdges;
