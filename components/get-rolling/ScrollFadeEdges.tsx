/**
 * ScrollFadeEdges Component
 * Adds transparent blur effects at top and bottom of scroll containers
 * Creates smooth visual transition when content is scrollable
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
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
      {/* Top fade - transparent blur */}
      {showTop && (
        <View style={[styles.topFade, { height: topFadeHeight }]} pointerEvents="none">
          <BlurView
            intensity={25}
            tint="default"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          {/* Gradient mask to fade out the blur */}
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      {/* Bottom fade - transparent blur */}
      {showBottom && (
        <View style={[styles.bottomFade, { height: bottomFadeHeight }]} pointerEvents="none">
          <BlurView
            intensity={25}
            tint="default"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          {/* Gradient mask to fade out the blur */}
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.08)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
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
    overflow: 'hidden',
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: -24,
    right: -24,
    zIndex: 10,
    overflow: 'hidden',
  },
});

export default ScrollFadeEdges;
