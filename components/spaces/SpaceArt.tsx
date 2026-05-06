/**
 * SpaceArt — painterly artwork primitive for Sound Spaces.
 *
 * 1:1 port of MBSpaceArt from
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-spaces.jsx
 *
 * Layered radial gradients (warm field → deep wash from the floor → cool
 * light from the top) plus an optional horizon line and a wandering
 * "presence" dot. Two variants:
 *   • "tile"  — used on the home card and index thumbnails (no horizon)
 *   • "field" — used full-bleed on the sitting screen (with horizon)
 *
 * The dot drifts on an 18s ease-in-out loop when `moving` is true,
 * matching `mb-space-drift` in the design.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { SpacePalette } from '@/services/spaces/spaces';

type Variant = 'tile' | 'field';

interface Props {
  palette: SpacePalette;
  variant?: Variant;
  moving?: boolean;
  /** When false, the painterly field renders without the wandering
   *  presence dot. Default true for back-compat with card/tile use. The
   *  sitting screen sets this to false because it owns the only visible
   *  dot (the timeline progress dot). */
  showDot?: boolean;
  /** When false, the field variant skips its built-in horizon line.
   *  The sitting screen sets this to false because it draws its own
   *  scrubber track at the timeline position; SpaceArt's horizon
   *  (painted at top:58% of the full bleed) wouldn't line up with
   *  the dot, especially on tall/short phones. */
  showHorizon?: boolean;
}

export default function SpaceArt({
  palette,
  variant = 'tile',
  moving = false,
  showDot = true,
  showHorizon = true,
}: Props) {
  const isField = variant === 'field';
  // Unique gradient ids per instance — SVG defs are global by id.
  const idPrefix = useRef(`sa${Math.random().toString(36).slice(2, 9)}`).current;
  const idWarm = `${idPrefix}-warm`;
  const idDeep = `${idPrefix}-deep`;
  const idCool = `${idPrefix}-cool`;

  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!moving) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 18000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 18000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [moving, drift]);

  // Field-variant dot drifts further; tile is subtle.
  const driftRangeX = isField ? -22 : -14;
  const driftRangeY = isField ? 12 : 8;
  const dotTranslateX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, driftRangeX] });
  const dotTranslateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, driftRangeY] });

  const dotSize = isField ? 14 : 8;
  const dotLeft = isField ? '50%' : '62%';
  const dotTop = isField ? '52%' : '38%';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={idWarm} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor={palette.warm} stopOpacity={1} />
            <Stop offset="100%" stopColor={palette.warm} stopOpacity={1} />
          </RadialGradient>
          {/* Deep wash from the bottom-left "floor" */}
          <RadialGradient id={idDeep} cx="30%" cy="110%" rx="70%" ry="70%" fx="30%" fy="110%">
            <Stop offset="0%" stopColor={palette.deep} stopOpacity={isField ? 0.45 : 0.5} />
            <Stop offset="55%" stopColor={palette.deep} stopOpacity={0} />
          </RadialGradient>
          {/* Cool light from the top-right */}
          <RadialGradient id={idCool} cx="70%" cy="-10%" rx="80%" ry="80%" fx="70%" fy="-10%">
            <Stop offset="0%" stopColor={palette.cool} stopOpacity={isField ? 0.7 : 0.8} />
            <Stop offset="60%" stopColor={palette.cool} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100" height="100" fill={`url(#${idWarm})`} />
        <Rect width="100" height="100" fill={`url(#${idDeep})`} />
        <Rect width="100" height="100" fill={`url(#${idCool})`} />
      </Svg>

      {/* Horizon line — field variant only, centered ~58% down. Opt-out
       *  when the consuming screen draws its own (sitting screen). */}
      {isField && showHorizon && (
        <View
          style={{
            position: 'absolute',
            left: '8%',
            right: '8%',
            top: '58%',
            height: 1,
            backgroundColor: 'rgba(26,31,54,0.18)',
          }}
        />
      )}

      {/* Drifting presence dot — opt-out on surfaces that own their own dot. */}
      {showDot && (
        <Animated.View
          style={{
            position: 'absolute',
            left: dotLeft,
            top: dotTop,
            marginLeft: -dotSize / 2,
            marginTop: -dotSize / 2,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: palette.deep,
            transform: [{ translateX: dotTranslateX }, { translateY: dotTranslateY }],
          }}
        />
      )}
    </View>
  );
}
