/**
 * MoodDot — animated mood avatar shell.
 *
 * The artwork itself comes from `MoodVectorArt`, which crops the downloaded
 * `/Users/warmachine37/Downloads/moods vector.svg` sheet into individual
 * mood avatars. This file keeps the app-facing vocabulary, palette metadata,
 * animation, and accessibility behavior stable.
 */

import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { BRAND as C } from '@/components/common/BrandGlyphs';
import MoodVectorArt from './MoodVectorArt';

export type MoodId = 'notGood' | 'meh' | 'ok' | 'good' | 'amazing';

export const MOOD_KEYS: ReadonlyArray<MoodId> = [
  'notGood', 'meh', 'ok', 'good', 'amazing',
];

interface MoodPaletteEntry {
  fill: string;
  surface: string;
  stroke: string;
  label: string;
  note: string;
}

export const MOOD_PALETTE: Readonly<Record<MoodId, MoodPaletteEntry>> = {
  notGood: { fill: C.lavenderMid, surface: 'rgba(120,83,93,0.18)',   stroke: C.lavenderDeep, label: 'not good', note: 'a harder one today' },
  meh:     { fill: C.butter,      surface: 'rgba(239,216,176,0.36)', stroke: C.ink,          label: 'meh',      note: 'not much, not nothing' },
  ok:      { fill: C.sage,        surface: 'rgba(189,208,186,0.34)', stroke: C.ink,          label: 'OK',       note: 'getting through it' },
  good:    { fill: C.peach,       surface: 'rgba(195,202,227,0.42)', stroke: C.ink,          label: 'good',     note: 'some ease in the room' },
  amazing: { fill: C.lavender,    surface: 'rgba(243,191,203,0.36)', stroke: C.ink,          label: 'amazing',  note: 'a real lift today' },
};

const MOOD_ART_OFFSET_X: Readonly<Partial<Record<MoodId, number>>> = {
  notGood: -2,
  amazing: 1.5,
};

interface MoodDotProps {
  mood: MoodId;
  size?: number;
  animated?: boolean;
  delay?: number;
}

const MoodDot: React.FC<MoodDotProps> = ({
  mood,
  size = 120,
  animated = false,
  delay = 0,
}) => {
  const palette = MOOD_PALETTE[mood];
  const bob = useSharedValue(0);

  useEffect(() => {
    if (!animated) {
      cancelAnimation(bob);
      bob.value = 0;
      return;
    }

    bob.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0,  { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    return () => { cancelAnimation(bob); };
  }, [animated, delay, bob]);

  const offsetX = MOOD_ART_OFFSET_X[mood] ?? 0;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX }, { translateY: bob.value }],
  }));

  return (
    <Animated.View
      style={[{ width: size, height: size }, animatedStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`mood: ${palette.label}`}
    >
      <MoodVectorArt mood={mood} size={size} />
    </Animated.View>
  );
};

export default MoodDot;
