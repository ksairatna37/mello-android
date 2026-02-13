/**
 * Disclaimer Screen
 * Step 2 of new onboarding flow - after email verification
 *
 * Features:
 * - Auto-sliding taglines with beautiful images
 * - Info button for crisis helpline
 * - Main disclaimer message
 * - "Got it, Let's Start" button
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import CrisisBottomSheet from '@/components/onboarding/CrisisBottomSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 5;
const CURRENT_STEP = 2;
const SLIDE_DURATION = 4000; // 4 seconds per slide

// Animated Dot Component - gentle smooth transition
const AnimatedDot = ({ isActive, onPress }: { isActive: boolean; onPress: () => void }) => {
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, {
      duration: 400,
      easing: Easing.inOut(Easing.ease),
    });
  }, [isActive]);

  const dotStyle = useAnimatedStyle(() => {
    return {
      width: 8 + (progress.value * 16),
      height: 8,
      borderRadius: 4,
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        ['#E0E0E0', '#FF6B35']
      ),
    };
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View style={dotStyle} />
    </TouchableOpacity>
  );
};

// Lyrical, poetic taglines - Mello as a gentle presence in the night
const SLIDES = [
  {
    tagline: 'The night is long\nbut you\'re not alone in it',
    subtitle: 'I\'m here, awake with you',
    image: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80',
  },
  {
    tagline: 'Every feeling is a visitor\nknocking at your door',
    subtitle: 'Let\'s welcome them together',
    image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80',
  },
  {
    tagline: 'After rain, roots grow deeper\nand so will you',
    subtitle: 'I\'ll show you how',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  },
  {
    tagline: 'No masks needed here\njust you, unfiltered',
    subtitle: 'This space holds all of you',
    image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800&q=80',
  },
];

export default function DisclaimerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [targetSlide, setTargetSlide] = useState(0);
  const [displayedSlide, setDisplayedSlide] = useState(0);
  const [showCrisisSheet, setShowCrisisSheet] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstRender = useRef(true);

  const fadeAnim = useSharedValue(1);

  // Progress bar width calculation
  const progressWidth = (CURRENT_STEP / TOTAL_STEPS) * 100;

  // Auto-advance slides
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTargetSlide((prev) => (prev + 1) % SLIDES.length);
    }, SLIDE_DURATION);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Smooth crossfade: fade out -> update content -> fade in
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Step 1: Fade out current content
    fadeAnim.value = withTiming(0, {
      duration: 400,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });

    // Step 2: After fade out, update displayed content and fade in
    const timeout = setTimeout(() => {
      setDisplayedSlide(targetSlide);
      fadeAnim.value = withTiming(1, {
        duration: 500,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [targetSlide]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [
      {
        scale: 0.97 + (fadeAnim.value * 0.03),
      },
    ],
  }));

  const handleContinue = () => {
    router.push('/(onboarding-new)/name-input' as any);
  };

  const handleInfoPress = () => {
    setShowCrisisSheet(true);
  };

  const handleDotPress = (index: number) => {
    setTargetSlide(index);
    // Reset timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setTargetSlide((prev) => (prev + 1) % SLIDES.length);
    }, SLIDE_DURATION);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Background Gradient */}
      <LinearGradient
        colors={['#FAF8F5', '#f5eee5', '#bbddf2']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
        {/* Header with Logo and Info Button */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.logo}>mello</Text>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={handleInfoPress}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={28} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressWidth}%` }]} />
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Compact Elevated Card with Slider */}
          <View style={styles.sliderCard}>
            {/* Image - More landscape oriented */}
            <Animated.View style={[styles.imageContainer, contentStyle]}>
              <Image
                source={{ uri: SLIDES[displayedSlide].image }}
                style={styles.slideImage}
                resizeMode="cover"
              />
            </Animated.View>

            {/* Tagline - Story-like formatting with line breaks */}
            <Animated.View style={[styles.taglineContainer, contentStyle]}>
              <Text style={styles.tagline}>{SLIDES[displayedSlide].tagline}</Text>
            </Animated.View>

            {/* Subtitle - blends with corresponding tagline */}
            <Animated.Text style={[styles.subtitle, contentStyle]}>
              {SLIDES[displayedSlide].subtitle}
            </Animated.Text>

            {/* Progress Dots - Animated */}
            <View style={styles.dotsContainer}>
              {SLIDES.map((_, index) => (
                <AnimatedDot
                  key={index}
                  isActive={index === targetSlide}
                  onPress={() => handleDotPress(index)}
                />
              ))}
            </View>
          </View>

          {/* Disclaimer Title */}
          <View style={styles.disclaimerContainer}>
            <Text style={styles.disclaimerTitle}>
              I'm here to support you, but I'm not a replacement for therapy or medical care.
            </Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Got it, Let's Start</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Crisis Bottom Sheet */}
      <CrisisBottomSheet
        visible={showCrisisSheet}
        onClose={() => setShowCrisisSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerSpacer: {
    width: 28,
  },
  logo: {
    fontSize: 32,
    fontFamily: 'Playwrite',
    color: '#1A1A1A',
  },
  infoButton: {
    padding: 4,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E8E4E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  sliderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1.25, // More landscape/square ratio for compact look
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  taglineContainer: {
    height: 62, // Fixed height for 2 lines (28px lineHeight × 2 + padding)
    marginBottom: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tagline: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: '#888888',
    textAlign: 'center',
    marginBottom: 12,
    height: 18, // Fixed height to prevent layout shift
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disclaimerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  disclaimerTitle: {
    fontSize: 24,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 32,
  },
  continueButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
});
