/**
 * WaveformVisualizer Component
 * Animated audio waveform bars using react-native-svg + reanimated
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface WaveformVisualizerProps {
  isActive: boolean;
  barCount?: number;
  color?: string;
  height?: number;
}

const MIN_HEIGHT = 4;
const MAX_HEIGHT = 40;

function WaveformBar({
  index,
  isActive,
  color,
  barWidth,
  containerHeight,
}: {
  index: number;
  isActive: boolean;
  color: string;
  barWidth: number;
  containerHeight: number;
}) {
  const barHeight = useSharedValue(MIN_HEIGHT);

  useEffect(() => {
    if (isActive) {
      const randomMax = MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);
      const randomMax2 = MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);
      const duration = 300 + Math.random() * 400;

      barHeight.value = withDelay(
        index * 30,
        withRepeat(
          withSequence(
            withTiming(randomMax, { duration, easing: Easing.inOut(Easing.ease) }),
            withTiming(randomMax2, { duration: duration * 0.8, easing: Easing.inOut(Easing.ease) }),
            withTiming(MIN_HEIGHT + Math.random() * 10, { duration: duration * 0.6, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true
        )
      );
    } else {
      barHeight.value = withTiming(MIN_HEIGHT, { duration: 400 });
    }
  }, [isActive]);

  const animatedProps = useAnimatedProps(() => ({
    height: barHeight.value,
    y: containerHeight / 2 - barHeight.value / 2,
  }));

  return (
    <AnimatedRect
      x={index * (barWidth + 3)}
      rx={barWidth / 2}
      ry={barWidth / 2}
      width={barWidth}
      fill={color}
      opacity={0.8}
      animatedProps={animatedProps}
    />
  );
}

export default function WaveformVisualizer({
  isActive,
  barCount = 24,
  color = '#b9a6ff',
  height = 60,
}: WaveformVisualizerProps) {
  const barWidth = 4;
  const totalWidth = barCount * (barWidth + 3) - 3;

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={totalWidth} height={height}>
        {Array.from({ length: barCount }, (_, i) => (
          <WaveformBar
            key={i}
            index={i}
            isActive={isActive}
            color={color}
            barWidth={barWidth}
            containerHeight={height}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
