/**
 * Mello Animated Splash Screen
 * Displays the "mello" text animation (Apple "hello" style)
 * with DreamyGradient background
 * Created with LottieLab
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import DreamyGradient from './DreamyGradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedSplashProps {
  onComplete: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onComplete }) => {
  const lottieRef = useRef<LottieView>(null);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const animationFinished = useRef(false);

  useEffect(() => {
    // Play the animation
    if (lottieRef.current) {
      lottieRef.current.play();
    }
  }, []);

  // Called when Lottie animation finishes
  const handleAnimationFinish = () => {
    if (animationFinished.current) return; // Prevent double trigger
    animationFinished.current = true;

    console.log('>>> Lottie animation finished, waiting 2 seconds...');

    // Subtle scale up
    scale.value = withTiming(1.05, {
      duration: 800,
      easing: Easing.out(Easing.ease),
    });

    // Wait 2 seconds, then fade out and redirect
    setTimeout(() => {
      console.log('>>> Starting fade out...');
      opacity.value = withTiming(
        0,
        { duration: 500, easing: Easing.out(Easing.ease) },
        (finished) => {
          if (finished) {
            console.log('>>> Fade complete, redirecting...');
            runOnJS(onComplete)();
          }
        }
      );
    }, 2000);
  };

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Dreamy gradient background with floating clouds & particles */}
      <DreamyGradient />

      {/* Mello text animation overlay */}
      <View style={styles.lottieContainer}>
        <LottieView
          ref={lottieRef}
          source={require('@/assets/animations/mello-hello.json')}
          style={styles.lottie}
          autoPlay={false}
          loop={false}
          speed={1}
          resizeMode="contain"
          onAnimationFinish={handleAnimationFinish}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  lottieContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_HEIGHT * 0.35,
  },
});
