/**
 * DreamyGradient Component
 * Animated pink/purple/blue gradient background with floating clouds
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Animated, Easing } from 'react-native';
import Svg, { Defs, RadialGradient, Ellipse, Stop, LinearGradient, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CloudConfig {
  color: string;
  size: number;
  initialX: number;
  initialY: number;
  moveX: number;
  moveY: number;
  duration: number;
  delay: number;
}

const CLOUDS: CloudConfig[] = [
  { color: '#F8D0E8', size: 280, initialX: -40, initialY: SCREEN_HEIGHT * 0.08, moveX: 40, moveY: 30, duration: 8000, delay: 0 },
  { color: '#E8C0E8', size: 350, initialX: SCREEN_WIDTH * 0.25, initialY: SCREEN_HEIGHT * 0.35, moveX: -30, moveY: 25, duration: 10000, delay: 1000 },
  { color: '#B0D8F8', size: 240, initialX: SCREEN_WIDTH * 0.6, initialY: -20, moveX: -25, moveY: 35, duration: 7000, delay: 500 },
  { color: '#F0B8D0', size: 300, initialX: SCREEN_WIDTH * 0.1, initialY: SCREEN_HEIGHT * 0.75, moveX: 45, moveY: -20, duration: 9000, delay: 2000 },
  { color: '#D0C8F0', size: 260, initialX: SCREEN_WIDTH * 0.55, initialY: SCREEN_HEIGHT * 0.5, moveX: -35, moveY: 30, duration: 11000, delay: 1500 },
];

const FloatingCloud = ({ config, index }: { config: CloudConfig; index: number }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animate = () => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: config.moveX,
              duration: config.duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: config.moveY,
              duration: config.duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1.1,
              duration: config.duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 0,
              duration: config.duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: 0,
              duration: config.duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: config.duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    };

    const timeout = setTimeout(animate, config.delay);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View
      style={[
        styles.cloud,
        {
          left: config.initialX,
          top: config.initialY,
          width: config.size,
          height: config.size,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <Svg width={config.size} height={config.size}>
        <Defs>
          <RadialGradient id={`cloud${index}`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={config.color} stopOpacity="0.8" />
            <Stop offset="40%" stopColor={config.color} stopOpacity="0.4" />
            <Stop offset="70%" stopColor={config.color} stopOpacity="0.1" />
            <Stop offset="100%" stopColor={config.color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={config.size / 2}
          cy={config.size / 2}
          rx={config.size / 2}
          ry={config.size / 2}
          fill={`url(#cloud${index})`}
        />
      </Svg>
    </Animated.View>
  );
};

export default function DreamyGradient() {
  return (
    <View style={styles.container}>
      {/* Base gradient */}
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="mainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#A8D4F5" stopOpacity="1" />
            <Stop offset="20%" stopColor="#C9B8E8" stopOpacity="1" />
            <Stop offset="40%" stopColor="#E8C8E8" stopOpacity="1" />
            <Stop offset="60%" stopColor="#F0C0D8" stopOpacity="1" />
            <Stop offset="80%" stopColor="#D8B8E0" stopOpacity="1" />
            <Stop offset="100%" stopColor="#B8C8E8" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#mainGrad)" />
      </Svg>

      {/* Floating clouds - now as individual ellipses */}
      {CLOUDS.map((cloud, index) => (
        <FloatingCloud key={index} config={cloud} index={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  cloud: {
    position: 'absolute',
  },
});
