/**
 * SelfMind Animated Splash — exact match to MBSplash in the Claude Design
 * mockups (mobile-screens-onboarding.jsx).
 *
 * - Cream canvas
 * - Soft peach ambient field (top-left) and lavender field (bottom-right).
 *   Faked with react-native-svg RadialGradient circles since RN can't do
 *   CSS filter: blur(60px).
 * - Centered stack: 180px breathing orb, Fraunces "selfmind" wordmark
 *   (italic "mind"), mono kicker "A QUIETER PLACE TO THINK".
 * - Bottom: thin progress track (animates 0 → 100% during the splash) and
 *   "SELFMIND · HEALTH" mono label.
 *
 * Duration ≈ 2.2s then fades out and calls onComplete().
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
// Splash uses a static PNG, not the WebView orb — splash IS the moment the
// WebView native module first loads, so we'd race ourselves. The OS-level
// splash carries the same image so the handoff is seamless.
const ORB_V2 = require('../../assets/orb-v2.png');
import { BRAND as C } from './BrandGlyphs';

const { width: W, height: H } = Dimensions.get('window');

interface AnimatedSplashProps {
  onComplete: () => void;
}

/** Soft gaussian-style blur fake — a radial gradient that fades to transparent. */
function AmbientField({
  color,
  size,
  opacity,
  style,
}: {
  color: string;
  size: number;
  opacity: number;
  style: { top?: number; left?: number; right?: number; bottom?: number };
}) {
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, opacity }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`amb-${color}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="55%" stopColor={color} stopOpacity="0.6" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#amb-${color})`} />
      </Svg>
    </View>
  );
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onComplete }) => {
  const opacity = useSharedValue(1);
  const progress = useSharedValue(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    // Splash lives for ~4.2s so it can actually be appreciated, then fades.
    progress.value = withTiming(1, { duration: 3800, easing: Easing.out(Easing.cubic) });

    const t = setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      opacity.value = withTiming(
        0,
        { duration: 550, easing: Easing.out(Easing.cubic) },
        (done) => { if (done) runOnJS(onComplete)(); },
      );
    }, 4200);

    return () => clearTimeout(t);
  }, [onComplete, opacity, progress]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Soft ambient color fields — peach top-left, lavender bottom-right */}
      <AmbientField
        color={C.peach}
        size={280}
        opacity={0.55}
        style={{ top: -80, left: -60 }}
      />
      <AmbientField
        color={C.lavender}
        size={300}
        opacity={0.45}
        style={{ bottom: -100, right: -80 }}
      />

      {/* Centered stack: orb + wordmark + kicker */}
      <View style={styles.center}>
        <Image
          source={ORB_V2}
          style={{ width: 350, height: 350 }}
          resizeMode="contain"
          fadeDuration={0}
        />
        <View style={styles.textStack}>
          <Text style={styles.wordmark}>
            self<Text style={styles.wordmarkItalic}>mind</Text>
          </Text>
          <Text style={styles.kicker}>A QUIETER PLACE TO THINK</Text>
        </View>
      </View>

      {/* Bottom: progress track + company mark */}
      <View style={styles.bottom}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
        <Text style={styles.company}>SELFMIND · HEALTH</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    width: W,
    height: H,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  center: { alignItems: 'center', gap: 32, width: '100%' },
  textStack: { width: '100%', alignItems: 'center' },
  // Wordmark: full screen width + textAlign center. No shrink-wrap box, no
  // italic-overhang clipping. includeFontPadding:false kills Android's
  // default ascender/descender padding that can crop from the top.
  wordmark: {
    width: '100%',
    fontFamily: 'Fraunces-XL',
    fontSize: 64,
    lineHeight: 76,
    color: C.ink,
    textAlign: 'center',
    includeFontPadding: false,
  },
  wordmarkItalic: { fontFamily: 'Fraunces-XL-Italic' },
  kicker: {
    marginTop: 14,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 1.8,
    color: C.ink3,
  },
  bottom: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    width: 56,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(26,31,54,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: C.ink,
    borderRadius: 2,
  },
  company: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    letterSpacing: 1.4,
    color: C.ink3,
  },
});
