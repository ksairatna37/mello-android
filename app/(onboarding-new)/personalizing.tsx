/**
 * Personalizing Screen
 * Warm, human transition screen - Mello speaks directly
 *
 * Animation Sequence:
 * 1. Logo starts at exact screen center (P2)
 * 2. Logo animation plays
 * 3. Logo slides up to P1 (final position with subtitle)
 * 4. Subtitle fades in below logo
 * 5. Bottom text fades in
 * 6. Continue button fades in
 *
 * MATH:
 * - Logo height: 100px
 * - Subtitle height: ~30px
 * - Gap between logo and subtitle: 16px
 * - Total content height at P1: 100 + 16 + 30 = 146px
 *
 * P2 (center, logo only): logoTop = (screenHeight - 100) / 2
 * P1 (center, logo + subtitle): logoTop = (screenHeight - 146) / 2
 * Slide distance: P2 - P1 = (146 - 100) / 2 = 23px
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import DreamyGradient from '@/components/common/DreamyGradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { getOnboardingData } from '@/utils/onboardingStorage';

// ═══════════════════════════════════════════════════════════════════════════
// SAFE PERSONALIZATION PHILOSOPHY
// ═══════════════════════════════════════════════════════════════════════════
// - Reflect their words, never interpret
// - Adjust warmth based on moodIntensity
// - Never claim meaning or diagnose
// - "Presence over psychology"
// ═══════════════════════════════════════════════════════════════════════════

// Greeting variations based on primary feeling - warm without interpreting
const FEELING_GREETINGS: Record<string, string> = {
  anxious: "I'm here with you",
  stressed: "I'm glad you're taking this moment",
  lonely: "You're not alone right now",
  burnout: "I'm glad you're here",
  relationship: "I'm here to listen",
  sleep: "I'm here with you",
  talk: "I'm here to listen",
  exploring: "I'm excited to meet you",
  other: "I'm so glad you're here",
};

// Bottom text variations - presence, not psychology
const FEELING_BOTTOM_TEXT: Record<string, string> = {
  anxious: "I'm keeping what you shared in mind.\nLet's take this gently...",
  stressed: "I'm keeping what you shared in mind.\nNo rush here...",
  lonely: "I'm keeping what you shared in mind.\nLet's get to know each other...",
  burnout: "I'm keeping what you shared in mind.\nLet's take this at your pace...",
  default: "I'm keeping what you shared in mind.\nLet's learn a little more about you...",
};

// Warmth phrases for high intensity - extra gentle
const WARMTH_PHRASES: Record<number, string> = {
  0: '', // Calm
  1: '', // Finding rhythm
  2: ' Take your time.', // Carrying a lot
  3: " There's no rush.", // Struggling
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Measurements
const LOGO_HEIGHT = 100;
const SUBTITLE_HEIGHT = 30;
const GAP = 6; // Tight gap between logo and subtitle
const TOTAL_CONTENT_HEIGHT = LOGO_HEIGHT + GAP + SUBTITLE_HEIGHT; // 146px

// P2: Logo at exact center (only logo visible)
const P2_LOGO_TOP = (SCREEN_HEIGHT - LOGO_HEIGHT) / 2;

// P1: Logo + subtitle centered together
const P1_LOGO_TOP = (SCREEN_HEIGHT - TOTAL_CONTENT_HEIGHT) / 2;

// Slide distance (how much logo moves up from P2 to P1)
const SLIDE_DISTANCE = P2_LOGO_TOP - P1_LOGO_TOP; // ≈ 23px

export default function PersonalizingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ firstName?: string }>();
  const { user } = useAuth();
  const lottieRef = useRef<LottieView>(null);
  const [showContent, setShowContent] = useState(false);

  // Personalization state
  const [firstName, setFirstName] = useState<string>(params.firstName || 'there');
  const [primaryFeeling, setPrimaryFeeling] = useState<string | null>(null);
  const [moodIntensity, setMoodIntensity] = useState<number>(0);

  // Load personalization data from storage
  useEffect(() => {
    const loadPersonalization = async () => {
      try {
        const data = await getOnboardingData();
        if (data.firstName) setFirstName(data.firstName);
        if (data.selectedFeelings?.length) {
          setPrimaryFeeling(data.selectedFeelings[0]);
        }
        if (typeof data.moodIntensity === 'number') {
          setMoodIntensity(data.moodIntensity);
        }
      } catch (e) {
        console.log('Failed to load personalization:', e);
      }
    };
    loadPersonalization();
  }, []);

  // Logo starts at P2 (center), will animate to P1 (up)
  // translateY starts at 0, will go to -SLIDE_DISTANCE
  const logoTranslateY = useSharedValue(0);

  // Subtitle animation
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(15);

  // Bottom text animation
  const bottomTextOpacity = useSharedValue(0);
  const bottomTextTranslateY = useSharedValue(20);

  // Button animation
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(25);

  // Called when Lottie animation finishes
  const onAnimationFinish = () => {
    // Step 1: Logo slides up from P2 to P1
    logoTranslateY.value = withTiming(-SLIDE_DISTANCE, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });

    // Step 2: Show subtitle container and fade it in
    setTimeout(() => {
      setShowContent(true);
    }, 400); // Show content midway through logo slide

    // Step 3: Subtitle fades in after logo slide
    const subtitleDelay = 900;
    subtitleOpacity.value = withDelay(
      subtitleDelay,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) })
    );
    subtitleTranslateY.value = withDelay(
      subtitleDelay,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // Step 4: Bottom text fades in (1 second after subtitle)
    const bottomTextDelay = subtitleDelay + 1000;
    bottomTextOpacity.value = withDelay(
      bottomTextDelay,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) })
    );
    bottomTextTranslateY.value = withDelay(
      bottomTextDelay,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // Step 5: Button fades in (1 second after bottom text)
    const buttonDelay = bottomTextDelay + 1000;
    buttonOpacity.value = withDelay(
      buttonDelay,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) })
    );
    buttonTranslateY.value = withDelay(
      buttonDelay,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
  };

  // Play Lottie animation on mount
  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.play();
    }
  }, []);

  // Screen fade out for cinematic transition
  const screenOpacity = useSharedValue(1);

  const handleContinue = () => {
    Vibration.vibrate(Platform.OS === 'ios' ? 10 : 50);

    // Cinematic fade out
    screenOpacity.value = withTiming(0, {
      duration: 600,
      easing: Easing.inOut(Easing.ease),
    });

    // Navigate after fade
    setTimeout(() => {
      router.push('/(get-rolling)/age' as any);
    }, 500);
  };

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  // Animated styles
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  const bottomTextStyle = useAnimatedStyle(() => ({
    opacity: bottomTextOpacity.value,
    transform: [{ translateY: bottomTextTranslateY.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  // Get personalized greeting - warm without interpreting
  const getGreeting = () => {
    const greeting = primaryFeeling && FEELING_GREETINGS[primaryFeeling]
      ? FEELING_GREETINGS[primaryFeeling]
      : "I'm so glad you're here";
    return `Hi ${firstName}, ${greeting}.`;
  };

  // Get personalized bottom text - presence, not psychology
  const getBottomText = () => {
    const base = primaryFeeling && FEELING_BOTTOM_TEXT[primaryFeeling]
      ? FEELING_BOTTOM_TEXT[primaryFeeling]
      : FEELING_BOTTOM_TEXT.default;
    const warmth = WARMTH_PHRASES[moodIntensity] || '';
    return base + warmth;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Animated.View style={[StyleSheet.absoluteFill, screenStyle]}>
        {/* Dreamy Gradient Background */}
        <DreamyGradient />

        {/* LOGO - Absolutely positioned at screen center (P2) */}
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <LottieView
            ref={lottieRef}
            source={require('@/assets/animations/mello-hello.json')}
            style={styles.lottie}
            autoPlay={false}
            loop={false}
            speed={1}
            resizeMode="contain"
            onAnimationFinish={onAnimationFinish}
          />
        </Animated.View>

        {/* SUBTITLE - Positioned right below logo at P1 */}
        {showContent && (
          <Animated.View style={[styles.subtitleContainer, subtitleStyle]}>
            <Text style={styles.message}>
              {getGreeting()}
            </Text>
          </Animated.View>
        )}

        {/* BOTTOM SECTION */}
        {showContent && (
          <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
            <Animated.Text style={[styles.bottomText, bottomTextStyle]}>
              {getBottomText()}
            </Animated.Text>

            <Animated.View style={buttonStyle}>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={handleContinue}
                activeOpacity={0.85}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  // Logo - absolutely positioned at exact center (P2)
  logoContainer: {
    position: 'absolute',
    top: P2_LOGO_TOP,
    left: 0,
    right: 0,
    height: LOGO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: SCREEN_WIDTH * 0.55,
    height: LOGO_HEIGHT,
  },
  // Subtitle - positioned right below logo at P1
  subtitleContainer: {
    position: 'absolute',
    top: P1_LOGO_TOP + LOGO_HEIGHT + GAP,
    left: 24,
    right: 24,
  },
  message: {
    fontSize: 22,
    fontFamily: 'Outfit-Medium',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Bottom section
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
  },
  bottomText: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginBottom: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  continueButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
});
