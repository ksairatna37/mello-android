/**
 * TypingIndicator Component
 * Apple Music-style breathing dots with opacity cascade
 * - Breathing: scale in/out like inhale-exhale (continuous)
 * - Opacity: cascade (1,0.6,0.4) → (1,1,0.4) → (1,1,1) with 1s gaps
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const DOT_SIZE = 10;
const DOT_GAP = 8;
const BREATH_DURATION = 1500; // inhale-exhale cycle
const OPACITY_DELAY = 1000; // 1 second between opacity transitions

interface TypingIndicatorProps {
  color?: string;
}

const Dot = ({
  index,
  breathScale,
  color
}: {
  index: number;
  breathScale: Animated.SharedValue<number>;
  color: string;
}) => {
  const opacity = useSharedValue(index === 0 ? 1 : index === 1 ? 0.6 : 0.4);

  useEffect(() => {
    // Opacity cascade animation
    // Dot 0: always 1
    // Dot 1: 0.6 → 1 after 1s
    // Dot 2: 0.4 → 1 after 2s
    // Then reset and repeat

    const startDelay = index * OPACITY_DELAY;
    const totalCycle = 3 * OPACITY_DELAY; // Full cycle duration

    opacity.value = withDelay(
      startDelay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.ease }),
          withDelay(totalCycle - 300 - startDelay, withTiming(index === 0 ? 1 : index === 1 ? 0.6 : 0.4, { duration: 300 }))
        ),
        -1,
        false
      )
    );
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: breathScale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
};

export default function TypingIndicator({ color = 'rgba(255, 255, 255, 0.9)' }: TypingIndicatorProps) {
  const breathScale = useSharedValue(1);

  useEffect(() => {
    // Breathing animation - continuous inhale/exhale
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: BREATH_DURATION / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: BREATH_DURATION / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  return (
    <View style={styles.container}>
      {[0, 1, 2].map((index) => (
        <Dot key={index} index={index} breathScale={breathScale} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DOT_GAP,
    height: 24,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
