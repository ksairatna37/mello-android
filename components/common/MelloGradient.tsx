/**
 * MelloGradient — Lightweight gradient with optional speaker crossfade
 *
 * Static blob positions (no continuous animation).
 * When speaker prop is provided, crossfades between warm (user) and cool (mello)
 * using a single shared value — minimal UI thread cost vs VoiceGradientBg's 7.
 *
 * Without speaker prop: shows mello palette only (zero animation).
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// ── Color palettes ──
const WARM_BG = '#FFF8F2';
const COOL_BG = '#F2F0FF';

const WARM_COLORS = ['#FFB8B8', '#FFDAB9', '#FFC5A8'] as const; // pink, peach, coral
const COOL_COLORS = ['#fccfff', '#c1e3ff', '#D4C8FF'] as const; // lavender, sky blue, lilac

// ── Blob positions (static — no movement animation) ──
const BLOBS = [
  { cx: 0.25, cy: 0.18, rx: 0.45, ry: 0.30 },
  { cx: 0.72, cy: 0.45, rx: 0.40, ry: 0.32 },
  { cx: 0.38, cy: 0.78, rx: 0.45, ry: 0.28 },
] as const;

const CROSSFADE_MS = 800;
const EASING = Easing.inOut(Easing.sin);

export type MelloGradientSpeaker = 'user' | 'mello';

interface MelloGradientProps {
  /** When provided, enables warm/cool crossfade. Without it, always mello palette. */
  speaker?: MelloGradientSpeaker;
}

// ── Static gradient defs (warm + cool) ──
function GradientDefs() {
  return (
    <Defs>
      {WARM_COLORS.map((color, i) => (
        <RadialGradient key={`w${i}`} id={`mgW${i}`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <Stop offset="35%" stopColor={color} stopOpacity="0.4" />
          <Stop offset="65%" stopColor={color} stopOpacity="0.15" />
          <Stop offset="85%" stopColor={color} stopOpacity="0.04" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      ))}
      {COOL_COLORS.map((color, i) => (
        <RadialGradient key={`c${i}`} id={`mgC${i}`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <Stop offset="35%" stopColor={color} stopOpacity="0.4" />
          <Stop offset="65%" stopColor={color} stopOpacity="0.15" />
          <Stop offset="85%" stopColor={color} stopOpacity="0.04" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      ))}
    </Defs>
  );
}

function MelloGradient({ speaker }: MelloGradientProps) {
  const { width, height } = useWindowDimensions();

  // 0 = warm (user), 1 = cool (mello) — single shared value
  const progress = useSharedValue(1);

  useEffect(() => {
    if (!speaker) return;
    progress.value = withTiming(
      speaker === 'mello' ? 1 : 0,
      { duration: CROSSFADE_MS, easing: EASING },
    );
  }, [speaker]);

  // Background color crossfade
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [WARM_BG, COOL_BG]),
  }));

  // Warm blobs (visible when user speaking)
  const warmProps0 = useAnimatedProps(() => ({ opacity: 1 - progress.value }));
  const warmProps1 = useAnimatedProps(() => ({ opacity: 1 - progress.value }));
  const warmProps2 = useAnimatedProps(() => ({ opacity: 1 - progress.value }));

  // Cool blobs (visible when mello speaking)
  const coolProps0 = useAnimatedProps(() => ({ opacity: progress.value }));
  const coolProps1 = useAnimatedProps(() => ({ opacity: progress.value }));
  const coolProps2 = useAnimatedProps(() => ({ opacity: progress.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, bgStyle]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <GradientDefs />

        {/* Warm layer — visible when user speaking */}
        <AnimatedEllipse
          cx={BLOBS[0].cx * width} cy={BLOBS[0].cy * height}
          rx={BLOBS[0].rx * width} ry={BLOBS[0].ry * height}
          fill="url(#mgW0)" animatedProps={warmProps0}
        />
        <AnimatedEllipse
          cx={BLOBS[1].cx * width} cy={BLOBS[1].cy * height}
          rx={BLOBS[1].rx * width} ry={BLOBS[1].ry * height}
          fill="url(#mgW1)" animatedProps={warmProps1}
        />
        <AnimatedEllipse
          cx={BLOBS[2].cx * width} cy={BLOBS[2].cy * height}
          rx={BLOBS[2].rx * width} ry={BLOBS[2].ry * height}
          fill="url(#mgW2)" animatedProps={warmProps2}
        />

        {/* Cool layer — visible when mello speaking */}
        <AnimatedEllipse
          cx={BLOBS[0].cx * width} cy={BLOBS[0].cy * height}
          rx={BLOBS[0].rx * width} ry={BLOBS[0].ry * height}
          fill="url(#mgC0)" animatedProps={coolProps0}
        />
        <AnimatedEllipse
          cx={BLOBS[1].cx * width} cy={BLOBS[1].cy * height}
          rx={BLOBS[1].rx * width} ry={BLOBS[1].ry * height}
          fill="url(#mgC1)" animatedProps={coolProps1}
        />
        <AnimatedEllipse
          cx={BLOBS[2].cx * width} cy={BLOBS[2].cy * height}
          rx={BLOBS[2].rx * width} ry={BLOBS[2].ry * height}
          fill="url(#mgC2)" animatedProps={coolProps2}
        />
      </Svg>
    </Animated.View>
  );
}

export default memo(MelloGradient);
