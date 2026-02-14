/**
 * Terms & Trust Screen
 * Step 7 of new onboarding flow - "A quiet promise, before we begin"
 *
 * Emotionally-aware UX:
 * - Consent feels like clarity, not compliance
 * - Trust handoff, not legal wall
 * - Single card with sliding content
 * - Checkboxes fade in after viewing all cards
 * - Checkbox design from feelings-select.tsx
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Linking,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { updateOnboardingData } from '@/utils/onboardingStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CURRENT_STEP = 7;
const SWIPE_THRESHOLD = 80; // Minimum swipe distance to trigger slide change

// Smooth ease for animations
const EASE_OUT = Easing.bezier(0.4, 0, 0.2, 1);

// Trust story cards content - poetic, story-like format
const TRUST_SLIDES = [
  {
    id: 1,
    title: 'What you share here\nstays safe with you',
    subtitle: 'Like a journal only you can open',
    image: 'https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=800&q=80',
  },
  {
    id: 2,
    title: 'No one is watching\nno one is judging',
    subtitle: 'Speak freely, this space forgets nothing but forgives everything',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  },
  {
    id: 3,
    title: 'Your story belongs to you\nand only you',
    subtitle: 'To keep, to hold, or to release — whenever you choose',
    image: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&q=80',
  },
  {
    id: 4,
    title: 'And if you ever\nwish to walk away',
    subtitle: 'Everything disappears. No traces, no questions asked',
    image: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80',
  },
];

// Animated Dot Component (from disclaimer.tsx)
const AnimatedDot = ({ isActive, onPress }: { isActive: boolean; onPress: () => void }) => {
  const progress = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
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

// Checkbox Option Component (from feelings-select.tsx pattern)
const CheckboxOption = ({
  label,
  linkText,
  isSelected,
  onPress,
  onLinkPress,
}: {
  label: string;
  linkText?: string;
  isSelected: boolean;
  onPress: () => void;
  onLinkPress?: () => void;
}) => {
  const animatedValue = useSharedValue(isSelected ? 1 : 0);

  React.useEffect(() => {
    animatedValue.value = withTiming(isSelected ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.ease),
    });
  }, [isSelected]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(245, 240, 235, ${1 + animatedValue.value * 0.06})`,
    borderWidth: 1.5 + animatedValue.value * 0.5,
    borderColor: `rgba(200, 195, 190, ${0.6 + animatedValue.value * 0.4})`,
  }));

  const checkboxStyle = useAnimatedStyle(() => ({
    opacity: animatedValue.value,
    transform: [{ scale: 0.8 + animatedValue.value * 0.2 }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View style={[styles.optionCard, containerStyle]}>
        <Text style={styles.optionText}>
          {label}{' '}
          {linkText && (
            <Text style={styles.optionLink} onPress={onLinkPress}>
              {linkText}
            </Text>
          )}
        </Text>
        <Animated.View style={[styles.checkbox, checkboxStyle]}>
          <View style={styles.checkboxFilled}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function TermsTrustScreen() {
  const router = useRouter();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [displayedSlide, setDisplayedSlide] = useState(0);
  const [showConsent, setShowConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const fadeAnim = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const consentOpacity = useSharedValue(0);

  const canContinue = termsAccepted && privacyAccepted;

  // Function to go to previous slide (called from gesture)
  const goToPreviousSlide = () => {
    if (currentSlide > 0) {
      goToSlide(currentSlide - 1);
    }
  };

  // Pan gesture for swiping to previous slide (left to right only)
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      // If swiped far enough to the right and not on first slide, go to previous
      if (event.translationX > SWIPE_THRESHOLD && currentSlide > 0) {
        runOnJS(goToPreviousSlide)();
      }
    });

  const handleBack = () => {
    if (showConsent) {
      // Go back to card view
      setShowConsent(false);
      cardOpacity.value = withTiming(1, { duration: 300, easing: EASE_OUT });
      consentOpacity.value = withTiming(0, { duration: 300, easing: EASE_OUT });
    } else if (currentSlide > 0) {
      // Go to previous slide
      goToSlide(currentSlide - 1);
    } else {
      router.back();
    }
  };

  const handleContinue = async () => {
    if (canContinue) {
      // Save terms acceptance to storage
      await updateOnboardingData({
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
      });
      router.push('/(onboarding-new)/permissions' as any);
    }
  };

  const goToSlide = (index: number) => {
    // Fade out
    fadeAnim.value = withTiming(0, { duration: 250, easing: EASE_OUT });

    setTimeout(() => {
      setDisplayedSlide(index);
      setCurrentSlide(index);
      // Fade in
      fadeAnim.value = withTiming(1, { duration: 300, easing: EASE_OUT });
    }, 250);
  };

  const handleNextSlide = () => {
    // Haptic feedback on button press
    Vibration.vibrate(Platform.OS === 'ios' ? 50 : 70);

    if (currentSlide < TRUST_SLIDES.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      // Last slide - show consent
      cardOpacity.value = withTiming(0, { duration: 300, easing: EASE_OUT });
      setTimeout(() => {
        setShowConsent(true);
        consentOpacity.value = withTiming(1, { duration: 300, easing: EASE_OUT });
      }, 300);
    }
  };

  const contentStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: 0.97 + (fadeAnim.value * 0.03) }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: 0.95 + (cardOpacity.value * 0.05) }],
  }));

  const consentStyle = useAnimatedStyle(() => ({
    opacity: consentOpacity.value,
    transform: [{ translateY: 20 - (consentOpacity.value * 20) }],
  }));

  const openTerms = () => {
    Linking.openURL('https://melloai.health/terms');
  };

  const openPrivacy = () => {
    Linking.openURL('https://melloai.health/privacy');
  };

  return (
    <OnboardingLayout
      currentStep={CURRENT_STEP}
      onBack={handleBack}
      onNext={handleContinue}
      canGoBack={true}
      canGoNext={canContinue}
      showHelp={true}
      customHelpText="We'll never use your data in ways you don't expect."
      showFadeZone={showConsent}
      showFooter={showConsent}
    >
      <View style={styles.content}>
        {/* Subtitle */}
        <Text style={styles.subtitle}>A quiet promise, before we begin</Text>

        {/* Title */}
        <Text style={styles.title}>A place that listens,{'\n'}and keeps your trust</Text>

        {/* Privacy Note */}
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed" size={14} color="#9E9E9E" />
          <Text style={styles.privacyText} numberOfLines={2}>
            We'll only use this information to personalize your experience.
          </Text>
        </View>

        {/* Main Card - Slides through trust promises */}
        {!showConsent && (
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.sliderCard, cardStyle]}>
              {/* Image */}
              <Animated.View style={[styles.imageContainer, contentStyle]}>
                <Image
                  source={{ uri: TRUST_SLIDES[displayedSlide].image }}
                  style={styles.slideImage}
                  resizeMode="cover"
                />
              </Animated.View>

              {/* Title */}
              <Animated.View style={[styles.taglineContainer, contentStyle]}>
                <Text style={styles.tagline}>{TRUST_SLIDES[displayedSlide].title}</Text>
              </Animated.View>

              {/* Subtitle */}
              <Animated.Text style={[styles.slideSubtitle, contentStyle]}>
                {TRUST_SLIDES[displayedSlide].subtitle}
              </Animated.Text>

              {/* Next Button */}
              <TouchableOpacity
                style={styles.cardButton}
                onPress={handleNextSlide}
                activeOpacity={0.8}
              >
                <Text style={styles.cardButtonText}>
                  {currentSlide === TRUST_SLIDES.length - 1 ? 'I, understood' : 'Next'}
                </Text>
              </TouchableOpacity>

              {/* Progress Dots */}
              <View style={styles.dotsContainer}>
                {TRUST_SLIDES.map((_, index) => (
                  <AnimatedDot
                    key={index}
                    isActive={index === currentSlide}
                    onPress={() => goToSlide(index)}
                  />
                ))}
              </View>
            </Animated.View>
          </GestureDetector>
        )}

        {/* Consent Section - Appears after viewing all cards */}
        {showConsent && (
          <Animated.View style={[styles.consentSection, consentStyle]}>
            {/* Bridge text */}
            <Text style={styles.consentBridge}>
              Before we continue, just one small thing.
            </Text>

            {/* Checkboxes */}
            <View style={styles.checkboxContainer}>
              <CheckboxOption
                label="I agree to the"
                linkText="Terms of Service"
                isSelected={termsAccepted}
                onPress={() => setTermsAccepted(!termsAccepted)}
                onLinkPress={openTerms}
              />

              <CheckboxOption
                label="I understand the"
                linkText="Privacy Policy"
                isSelected={privacyAccepted}
                onPress={() => setPrivacyAccepted(!privacyAccepted)}
                onLinkPress={openPrivacy}
              />
            </View>

          </Animated.View>
        )}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingBottom: 0, // Minimal padding - footer hidden during card view
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: '#888888',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    lineHeight: 36,
    marginBottom: 8,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  privacyText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#9E9E9E',
    flex: 1,
  },
  // Card styles (from disclaimer.tsx)
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
    marginBottom: 32,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1.25, // Match disclaimer.tsx - more landscape/square ratio
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  taglineContainer: {
    minHeight: 62, // Min height for 2 lines, allows for 3 if needed
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
  slideSubtitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#888888',
    textAlign: 'center',
    marginBottom: 16,
    minHeight: 40, // Allow 2 lines for longer subtitles
    lineHeight: 20,
  },
  cardButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginBottom: 16,
    width: '100%', // Full width button
    alignItems: 'center',
  },
  cardButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  // Consent Section
  consentSection: {
    flex: 2/2.5,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  consentBridge: {
    fontSize: 18,
    fontFamily: 'Outfit-Medium',
    color: '#555555',
    textAlign: 'center',
    marginBottom: 10,
  },
  checkboxContainer: {
    gap: 12,
    marginBottom: 24,
  },
  // Checkbox styles (from feelings-select.tsx)
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#F5F0EB',
    borderWidth: 1.5,
    borderColor: 'rgba(200, 195, 190, 0.6)',
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    flex: 1,
  },
  optionLink: {
    color: '#1A1A1A',
    fontFamily: 'Outfit-SemiBold',
    textDecorationLine: 'underline',
  },
  checkbox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFilled: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
