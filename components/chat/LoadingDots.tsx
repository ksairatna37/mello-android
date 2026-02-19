/**
 * LoadingDots Component
 * 3 bouncing dots with staggered animation
 * Port of web's LoadingDots.tsx
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface LoadingDotsProps {
  color?: string;
  dotSize?: number;
}

function Dot({ delay, color, dotSize }: { delay: number; color: string; dotSize: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 300, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) }),
          withTiming(0, { duration: 400 }), // pause at bottom
        ),
        -1,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default function LoadingDots({
  color = 'rgba(107,107,123,0.5)',
  dotSize = 8,
}: LoadingDotsProps) {
  return (
    <View style={styles.container}>
      <Dot delay={0} color={color} dotSize={dotSize} />
      <Dot delay={200} color={color} dotSize={dotSize} />
      <Dot delay={400} color={color} dotSize={dotSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
});
