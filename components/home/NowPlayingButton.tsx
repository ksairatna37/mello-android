/**
 * NowPlayingButton — pill-style 36 px circle that surfaces beside the
 * home top-bar bell when a Sound Space is currently playing audio.
 *
 * Subscribes to `playingSpaceStore` via `useSyncExternalStore`. Renders
 * NOTHING when no space is playing — the home top-bar adjusts naturally
 * via flexbox. When a space IS playing:
 *   • Same size + chrome as the bell (36 paper circle, 1 px line border).
 *   • A short coral arc runs continuously around the perimeter — a
 *     "running border" indicating live playback. Implemented as an SVG
 *     stroke-dash arc on an Animated rotation loop.
 *   • Inner glyph: Wave (matches the catalog section of the playing
 *     room's autonomic state — and reads as "audio" without using a
 *     speaker / music-note glyph that would feel clinical).
 *   • Tap → `router.push({ pathname: '/space', params: { id }})`.
 *
 * Animation runs on the native driver (transform/opacity only) so it
 * doesn't pulse the JS thread.
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { BRAND as C } from '@/components/common/BrandGlyphs';
import { playingSpaceStore } from '@/services/spaces/playingSpaceStore';

const SIZE = 36;
const RADIUS = 15.5;          // inset so Android doesn't clip the stroke
const RING_WIDTH = 3;
const RING_COLOR = C.coral;   // same background color as Home's Start CTA
const ARC_LENGTH = 30;        // ~110° of the 2πr circumference
const ARC_GAP = 200;          // remainder so only one arc shows

export default function NowPlayingButton() {
  const router = useRouter();
  const playingId = useSyncExternalStore(
    playingSpaceStore.subscribe,
    playingSpaceStore.getSnapshot,
  );

  // Continuous rotation. Native-driven; stops when the button unmounts
  // or when no space is playing (effect cleanup).
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!playingId) return;
    rotation.setValue(0);
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [playingId, rotation]);

  if (!playingId) return null;

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handlePress = () => {
    router.push({ pathname: '/space', params: { id: playingId } } as any);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.btn}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {/* Rotating coral arc — the "running border" */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { transform: [{ rotate: spin }] }]}
      >
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={RING_COLOR}
            strokeWidth={RING_WIDTH}
            strokeDasharray={`${ARC_LENGTH} ${ARC_GAP}`}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Soft-cornered play triangle — same stroke-linejoin trick as
       * the sitting screen's transport play icon, scaled to 12 px. */}
      <Svg width={12} height={12} viewBox="0 0 24 24">
        <Path
          d="M8 5.5l11 6.5-11 6.5z"
          fill={C.ink}
          stroke={C.ink}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
