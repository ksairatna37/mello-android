/**
 * VoiceGradientBg — Full-screen animated gradient for voice chat
 *
 * Ultra-optimized: 7 shared values total (vs 37 in AuroraOrb)
 * Runs entirely on reanimated UI thread — zero JS thread blocking
 *
 * Two palettes cross-fade based on speaker:
 *   User speaking  → warm (baby pink + peach)
 *   Mello speaking → cool (lavender + sky blue)
 *
 * 3 blob positions × 2 color layers = 6 SVG ellipses
 * Warm/cool pairs share positions — opacity derived from 1 progress value
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type GradientSpeaker = 'user' | 'mello';

interface VoiceGradientBgProps {
  speaker: GradientSpeaker;
  isActive: boolean;
}

// ═══════════════════════════════════════════════════
// MODULE-LEVEL CONSTANTS (zero runtime cost)
// ═══════════════════════════════════════════════════

// Color palettes
const WARM_BG = '#FFF8F2';
const COOL_BG = '#F2F0FF';

const WARM_COLORS = ['#FFB8B8', '#FFDAB9', '#FFC5A8'] as const; // pink, peach, coral
const COOL_COLORS = ['#b9a6ff', '#A8D8FF', '#D4C8FF'] as const; // lavender, sky blue, lilac

// Blob positions (fractional screen coords)
const BLOBS = [
  { cx: 0.25, cy: 0.20, rx: 0.40, ry: 0.30, phaseX: 0.0, phaseY: 0.3 }, // upper-left
  { cx: 0.70, cy: 0.45, rx: 0.38, ry: 0.32, phaseX: 0.4, phaseY: 0.0 }, // center-right
  { cx: 0.40, cy: 0.78, rx: 0.42, ry: 0.28, phaseX: 0.7, phaseY: 0.5 }, // lower-center
] as const;

// Animation params
const IDLE_SPEED = 5000;
const IDLE_AMP = 25;
const ACTIVE_SPEED = 3000;
const ACTIVE_AMP = 40;
const CROSSFADE_MS = 800;

const EASING = Easing.inOut(Easing.sin);

// ═══════════════════════════════════════════════════
// GRADIENT DEFINITIONS (static — no animation needed)
// ═══════════════════════════════════════════════════

function GradientDefs() {
  return (
    <Defs>
      {WARM_COLORS.map((color, i) => (
        <RadialGradient key={`warm${i}`} id={`vgWarm${i}`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <Stop offset="35%" stopColor={color} stopOpacity="0.5" />
          <Stop offset="65%" stopColor={color} stopOpacity="0.2" />
          <Stop offset="85%" stopColor={color} stopOpacity="0.06" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      ))}
      {COOL_COLORS.map((color, i) => (
        <RadialGradient key={`cool${i}`} id={`vgCool${i}`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <Stop offset="35%" stopColor={color} stopOpacity="0.5" />
          <Stop offset="65%" stopColor={color} stopOpacity="0.2" />
          <Stop offset="85%" stopColor={color} stopOpacity="0.06" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      ))}
    </Defs>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

function VoiceGradientBg({ speaker, isActive }: VoiceGradientBgProps) {
  const { width, height } = useWindowDimensions();

  // ── 7 shared values (the entire animation budget) ──
  const offset0X = useSharedValue(0);
  const offset0Y = useSharedValue(0);
  const offset1X = useSharedValue(0);
  const offset1Y = useSharedValue(0);
  const offset2X = useSharedValue(0);
  const offset2Y = useSharedValue(0);
  const colorProgress = useSharedValue(1); // 0 = warm (user), 1 = cool (mello)

  const offsetsX = [offset0X, offset1X, offset2X];
  const offsetsY = [offset0Y, offset1Y, offset2Y];

  // ── Position animation (reacts to isActive) ──
  useEffect(() => {
    const speed = isActive ? ACTIVE_SPEED : IDLE_SPEED;
    const amp = isActive ? ACTIVE_AMP : IDLE_AMP;

    for (let i = 0; i < 3; i++) {
      const blob = BLOBS[i];
      const blobSpeed = speed * (0.85 + i * 0.15);
      const blobAmp = amp * (0.8 + i * 0.1);

      offsetsX[i].value = withDelay(
        blob.phaseX * blobSpeed,
        withRepeat(
          withSequence(
            withTiming(blobAmp, { duration: blobSpeed, easing: EASING }),
            withTiming(-blobAmp, { duration: blobSpeed, easing: EASING }),
          ),
          -1,
          true,
        ),
      );

      offsetsY[i].value = withDelay(
        blob.phaseY * blobSpeed,
        withRepeat(
          withSequence(
            withTiming(-blobAmp * 0.8, { duration: blobSpeed * 1.1, easing: EASING }),
            withTiming(blobAmp * 0.8, { duration: blobSpeed * 1.1, easing: EASING }),
          ),
          -1,
          true,
        ),
      );
    }
  }, [isActive]);

  // ── Color cross-fade (reacts to speaker) ──
  useEffect(() => {
    colorProgress.value = withTiming(
      speaker === 'mello' ? 1 : 0,
      { duration: CROSSFADE_MS, easing: EASING },
    );
  }, [speaker]);

  // ── Background color interpolation ──
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [WARM_BG, COOL_BG],
    ),
  }));

  // ── Animated props for each ellipse ──
  // Warm layer (opacity = 1 - progress)
  const warmProps0 = useAnimatedProps(() => ({
    cx: BLOBS[0].cx * width + offset0X.value,
    cy: BLOBS[0].cy * height + offset0Y.value,
    rx: BLOBS[0].rx * width,
    ry: BLOBS[0].ry * height,
    opacity: 1 - colorProgress.value,
  }));

  const warmProps1 = useAnimatedProps(() => ({
    cx: BLOBS[1].cx * width + offset1X.value,
    cy: BLOBS[1].cy * height + offset1Y.value,
    rx: BLOBS[1].rx * width,
    ry: BLOBS[1].ry * height,
    opacity: 1 - colorProgress.value,
  }));

  const warmProps2 = useAnimatedProps(() => ({
    cx: BLOBS[2].cx * width + offset2X.value,
    cy: BLOBS[2].cy * height + offset2Y.value,
    rx: BLOBS[2].rx * width,
    ry: BLOBS[2].ry * height,
    opacity: 1 - colorProgress.value,
  }));

  // Cool layer (opacity = progress)
  const coolProps0 = useAnimatedProps(() => ({
    cx: BLOBS[0].cx * width + offset0X.value,
    cy: BLOBS[0].cy * height + offset0Y.value,
    rx: BLOBS[0].rx * width,
    ry: BLOBS[0].ry * height,
    opacity: colorProgress.value,
  }));

  const coolProps1 = useAnimatedProps(() => ({
    cx: BLOBS[1].cx * width + offset1X.value,
    cy: BLOBS[1].cy * height + offset1Y.value,
    rx: BLOBS[1].rx * width,
    ry: BLOBS[1].ry * height,
    opacity: colorProgress.value,
  }));

  const coolProps2 = useAnimatedProps(() => ({
    cx: BLOBS[2].cx * width + offset2X.value,
    cy: BLOBS[2].cy * height + offset2Y.value,
    rx: BLOBS[2].rx * width,
    ry: BLOBS[2].ry * height,
    opacity: colorProgress.value,
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, bgStyle]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <GradientDefs />

        {/* Warm layer — visible when user speaking */}
        <AnimatedEllipse fill="url(#vgWarm0)" animatedProps={warmProps0} />
        <AnimatedEllipse fill="url(#vgWarm1)" animatedProps={warmProps1} />
        <AnimatedEllipse fill="url(#vgWarm2)" animatedProps={warmProps2} />

        {/* Cool layer — visible when mello speaking */}
        <AnimatedEllipse fill="url(#vgCool0)" animatedProps={coolProps0} />
        <AnimatedEllipse fill="url(#vgCool1)" animatedProps={coolProps1} />
        <AnimatedEllipse fill="url(#vgCool2)" animatedProps={coolProps2} />
      </Svg>
    </Animated.View>
  );
}

export default memo(VoiceGradientBg);
