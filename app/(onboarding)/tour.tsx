/**
 * Tour Screen
 * Quick tour of Mello's features - Story-like progression
 * Uses card container from disclaimer.tsx
 * Swipe left to right to go back
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import AuthBottomSheet from '@/components/onboarding/AuthBottomSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

const EASE_OUT = Easing.bezier(0.4, 0, 0.2, 1);

// Story-like tour slides with aesthetic images
const TOUR_SLIDES = [
  {
    tagline: 'Sometimes the hardest person\nto talk to is yourself',
    subtitle: 'Mello listens without judgment',
    image: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80',
  },
  {
    tagline: 'Your feelings are like weather\nalways changing, always valid',
    subtitle: 'Track your emotional seasons',
    image: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80',
  },
  {
    tagline: 'What you share here\nstays between us, always',
    subtitle: 'Your sanctuary, your story',
    image: 'https://images.unsplash.com/photo-1510797215324-95aa89f43c33?w=800&q=80',
  },
];

// Animated Dot Component
const AnimatedDot = ({ isActive, onPress }: { isActive: boolean; onPress: () => void }) => {
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, {
      duration: 400,
      easing: Easing.inOut(Easing.ease),
    });
  }, [isActive]);

  const dotStyle = useAnimatedStyle(() => ({
    width: 8 + (progress.value * 16),
    height: 8,
    borderRadius: 4,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['#E0E0E0', '#FF6B35']
    ),
  }));

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

export default function TourScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [displayedSlide, setDisplayedSlide] = useState(0);
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  const isFirstRender = useRef(true);

  const fadeAnim = useSharedValue(1);

  // Smooth crossfade animation
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Fade out
    fadeAnim.value = withTiming(0, { duration: 300, easing: EASE_OUT });

    const timeout = setTimeout(() => {
      setDisplayedSlide(currentSlide);
      // Fade in
      fadeAnim.value = withTiming(1, { duration: 350, easing: EASE_OUT });
    }, 300);

    return () => clearTimeout(timeout);
  }, [currentSlide]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: 0.97 + (fadeAnim.value * 0.03) }],
  }));

  const handleNext = () => {
    if (currentSlide < TOUR_SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      // Tour complete, show auth bottom sheet
      setShowAuthSheet(true);
    }
  };

  const handleSkip = () => {
    setShowAuthSheet(true);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Function to go to previous slide
  const goToPreviousSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // Pan gesture for swiping to previous slide (left to right only)
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD && currentSlide > 0) {
        runOnJS(goToPreviousSlide)();
      }
    });

  const slide = TOUR_SLIDES[displayedSlide];

  return (
    <OnboardingLayout
      currentStep={1}
      showFooter={false}
      showFadeZone={false}
      showHelp={false}
    >
      <View style={styles.content}>
        {/* Skip Button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Card Container - Swipeable (Fills available space) */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.sliderCard}>
            {/* Image */}
            <Animated.View style={[styles.imageContainer, contentStyle]}>
              <Image
                source={{ uri: slide.image }}
                style={styles.slideImage}
                resizeMode="cover"
              />
            </Animated.View>

            {/* Tagline - Story-like */}
            <Animated.View style={[styles.taglineContainer, contentStyle]}>
              <Text style={styles.tagline}>{slide.tagline}</Text>
            </Animated.View>

            {/* Subtitle */}
            <Animated.Text style={[styles.subtitle, contentStyle]}>
              {slide.subtitle}
            </Animated.Text>

            {/* Spacer to push dots to bottom */}
            <View style={styles.cardSpacer} />

            {/* Progress Dots - Inside Card */}
            <View style={styles.dotsContainer}>
              {TOUR_SLIDES.map((_, index) => (
                <AnimatedDot
                  key={index}
                  isActive={index === currentSlide}
                  onPress={() => goToSlide(index)}
                />
              ))}
            </View>
          </View>
        </GestureDetector>

        {/* CTA Button - Bottom of screen */}
        <TouchableOpacity
          style={[styles.ctaButton, { marginBottom: insets.bottom > 0 ? insets.bottom : 16 }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>
            {currentSlide === TOUR_SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Auth Bottom Sheet */}
      <AuthBottomSheet
        visible={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 12,
  },
  skipText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#888888',
  },
  // Card styles - Fills available space
  sliderCard: {
    flex: 1,
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
    aspectRatio: 1.2,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  taglineContainer: {
    minHeight: 62,
    marginBottom: 8,
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
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#888888',
    textAlign: 'center',
    minHeight: 20,
    lineHeight: 20,
  },
  // Spacer to push dots to bottom of card
  cardSpacer: {
    flex: 1,
  },
  // Dots inside card at bottom
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  // CTA button at bottom of screen
  ctaButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 16,
  },
  ctaButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
});
