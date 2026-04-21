/**
 * Mello Animated Splash Screen
 * Displays the "mello" text animation (Apple "hello" style)
 * with DreamyGradient background
 * + Fixed "take a deep breath" text
 * + Random phrase at bottom (picked once on load)
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
// import LottieView from 'lottie-react-native';
import DreamyGradient from './DreamyGradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Random phrases pool (one picked on each load)
const DYNAMIC_PHRASES = [
  "you're doing great",
  "one moment at a time",
  "be gentle with yourself",
  "you matter",
  "you're not alone",
  "you've got this",
  "feeling is healing",
  "you are enough",
];

interface AnimatedSplashProps {
  onComplete: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onComplete }) => {
  // const lottieRef = useRef<LottieView>(null);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const animationFinished = useRef(false);

  // Pick one random phrase on mount
  const [randomPhrase] = useState(
    () => DYNAMIC_PHRASES[Math.floor(Math.random() * DYNAMIC_PHRASES.length)]
  );

  // Called when Lottie animation finishes (now triggered by useEffect timer)
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

  useEffect(() => {
    const timer = setTimeout(handleAnimationFinish, 2500);
    return () => clearTimeout(timer);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));


  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Dreamy gradient background with floating clouds & particles */}
      <DreamyGradient />

      {/* SelfMind title */}
      <View style={styles.lottieContainer}>
        <Text style={styles.SelfMindText}>SelfMind</Text>
      </View>

      {/* Apple-style "hello" Lottie animation — commented out for SelfMind rebrand */}
      {/* <View style={styles.lottieContainer}>
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
      </View> */}

      {/* Fixed "take a deep breath" text */}
      <View style={styles.breatheContainer}>
        <Text style={styles.breatheText}>take a deep breath</Text>
      </View>

      {/* Random phrase at bottom */}
      <View style={styles.phraseContainer}>
        <Text style={styles.phraseText}>{randomPhrase}</Text>
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
  SelfMindText: {
    fontSize: 48,
    fontFamily: 'DMSerif',
    color: 'rgba(255, 255, 255, 0.95)',
    letterSpacing: 1.5,
  },
  breatheContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  breatheText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 1,
  },
  phraseContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  phraseText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.5,
  },
});
