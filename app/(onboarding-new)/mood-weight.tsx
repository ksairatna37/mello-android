/**
 * Mood Weight Screen
 * Step 6 of new onboarding flow - "How heavy does today feel?"
 *
 * Design: Pixel-perfect clone from Figma
 * - Full-width gradient container (edge to edge)
 * - Rounded corners ONLY at top-left and top-right
 * - Container extends from ~middle of screen to bottom
 * - Gradient (#FFFFFF → #c8e4f5) blends with background
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import CrisisCheckSheet from '@/components/onboarding/CrisisCheckSheet';
import { updateOnboardingData } from '@/utils/onboardingStorage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CURRENT_STEP = 6;
const TOTAL_STEPS = 6;

// Slider configuration
const SLIDER_HORIZONTAL_PADDING = 28; // Padding of container
const TRACK_INNER_PADDING = 8; // Padding inside the track (left & right)
const SLIDER_WIDTH = SCREEN_WIDTH - (SLIDER_HORIZONTAL_PADDING * 2);
const USABLE_SLIDER_WIDTH = SLIDER_WIDTH - (TRACK_INNER_PADDING * 2); // Width for thumb movement
const THUMB_SIZE = 56;
const TRACK_HEIGHT = 72;
const SNAP_POSITIONS = 4;
const SNAP_DURATION = 200;
const LABEL_HEIGHT = 70; // Height of each label item

// Emotional stages
const MOOD_STAGES = [
  { id: 'calm', label: 'Calm' },
  { id: 'rhythm', label: 'Finding my rhythm' },
  { id: 'heavy', label: 'Carrying a lot' },
  { id: 'struggling', label: 'Struggling' },
];

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

// Worklet functions - must be defined outside component for UI thread
const getSnapPositionWorklet = (stageIndex: number): number => {
  'worklet';
  const usableWidth = USABLE_SLIDER_WIDTH - THUMB_SIZE;
  return TRACK_INNER_PADDING + (stageIndex / (SNAP_POSITIONS - 1)) * usableWidth;
};

const getStageFromPositionWorklet = (position: number): number => {
  'worklet';
  const usableWidth = USABLE_SLIDER_WIDTH - THUMB_SIZE;
  const adjustedPosition = position - TRACK_INNER_PADDING;
  const normalized = Math.max(0, Math.min(adjustedPosition / usableWidth, 1));
  return Math.round(normalized * (SNAP_POSITIONS - 1));
};

// Regular JS function for use outside worklets
const getSnapPosition = (stageIndex: number): number => {
  const usableWidth = USABLE_SLIDER_WIDTH - THUMB_SIZE;
  return TRACK_INNER_PADDING + (stageIndex / (SNAP_POSITIONS - 1)) * usableWidth;
};

export default function MoodWeightScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firstName } = useLocalSearchParams<{ firstName: string }>();
  const [currentStage, setCurrentStage] = useState(1);
  const [showCrisisCheck, setShowCrisisCheck] = useState(false);

  // Shared values
  const translateX = useSharedValue(getSnapPosition(1));
  const thumbScale = useSharedValue(1);
  const labelListY = useSharedValue(-1 * LABEL_HEIGHT); // Start at stage 1
  const startX = useSharedValue(0);
  const currentStageShared = useSharedValue(1); // Track stage on UI thread

  const progressWidth = (CURRENT_STEP / TOTAL_STEPS) * 100;

  // Trigger haptic feedback when mood changes
  const triggerHaptic = useCallback(() => {
    // Noticeable vibration pulse
    Vibration.vibrate(Platform.OS === 'ios' ? 50 : 70);
  }, []);

  // Update React state from UI thread
  const syncStageToJS = useCallback((newStage: number) => {
    setCurrentStage(newStage);
    // Trigger haptic when stage changes
    Vibration.vibrate(Platform.OS === 'ios' ? 50 : 70);
  }, []);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = translateX.value;
      thumbScale.value = withTiming(1.05, { duration: 100, easing: EASE_OUT });
    })
    .onUpdate((event) => {
      'worklet';
      const newX = startX.value + event.translationX;
      const minX = TRACK_INNER_PADDING;
      const maxX = TRACK_INNER_PADDING + USABLE_SLIDER_WIDTH - THUMB_SIZE;

      if (newX < minX) {
        translateX.value = minX + (newX - minX) * 0.3;
      } else if (newX > maxX) {
        translateX.value = maxX + (newX - maxX) * 0.3;
      } else {
        translateX.value = newX;
      }

      // Calculate continuous progress (0 to 1) based on thumb position
      const progress = (translateX.value - minX) / (maxX - minX);
      // Smoothly scroll label reel based on progress (tied to thumb)
      const targetLabelY = -progress * (SNAP_POSITIONS - 1) * LABEL_HEIGHT;
      labelListY.value = targetLabelY;

      const stage = getStageFromPositionWorklet(translateX.value);
      if (stage !== currentStageShared.value) {
        currentStageShared.value = stage;
        runOnJS(syncStageToJS)(stage);
      }
    })
    .onEnd(() => {
      'worklet';
      thumbScale.value = withTiming(1, { duration: 150, easing: EASE_OUT });

      const minX = TRACK_INNER_PADDING;
      const maxX = TRACK_INNER_PADDING + USABLE_SLIDER_WIDTH - THUMB_SIZE;
      const clampedX = Math.max(minX, Math.min(translateX.value, maxX));
      const nearestStage = getStageFromPositionWorklet(clampedX);
      const snapPosition = getSnapPositionWorklet(nearestStage);

      translateX.value = withTiming(snapPosition, {
        duration: SNAP_DURATION,
        easing: EASE_OUT,
      });

      // Snap label reel to center the nearest stage label (smooth glide)
      const targetLabelY = -nearestStage * LABEL_HEIGHT;
      labelListY.value = withTiming(targetLabelY, {
        duration: 280,
        easing: EASE_OUT,
      });

      if (nearestStage !== currentStageShared.value) {
        currentStageShared.value = nearestStage;
        runOnJS(syncStageToJS)(nearestStage);
      }
    });

  const thumbStyle = useAnimatedStyle(() => {
    const minX = TRACK_INNER_PADDING;
    const maxX = TRACK_INNER_PADDING + USABLE_SLIDER_WIDTH - THUMB_SIZE;
    const clampedX = Math.max(minX, Math.min(translateX.value, maxX));
    return {
      transform: [
        { translateX: clampedX },
        { scale: thumbScale.value },
      ],
    };
  });

  // Label reel animated style - continuous vertical scroll
  const labelReelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: labelListY.value }],
  }));

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // If user selected "Struggling", show crisis check first
    if (currentStage === MOOD_STAGES.length - 1) {
      setShowCrisisCheck(true);
      return;
    }
    navigateToNext();
  };

  const navigateToNext = async () => {
    // Save mood intensity to storage
    await updateOnboardingData({ moodIntensity: currentStage });
    router.push({
      pathname: '/(onboarding-new)/terms-trust',
      params: { firstName, moodWeight: MOOD_STAGES[currentStage].id },
    } as any);
  };

  const handleCrisisCheckClose = () => {
    setShowCrisisCheck(false);
  };

  const handleCrisisCheckContinue = () => {
    setShowCrisisCheck(false);
    navigateToNext();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Background Gradient */}
      <LinearGradient
        colors={['#faf8f59c', '#f5eee5', '#c8e4f5']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Content Area */}
      <View style={[styles.topContent, { paddingTop: insets.top + 16 }]}>
        {/* Header with Logo */}
        <View style={styles.header}>
          <Text style={styles.logo}>mello</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressWidth}%` }]} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>How heavy does today feel for you?</Text>

        {/* Privacy Note */}
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed" size={14} color="#9E9E9E" />
          <Text style={styles.privacyText}>
            We'll only use this information to personalize your experience.
          </Text>
        </View>
      </View>

      {/* Full-width Slider Container - Extends to bottom */}
      <LinearGradient
        colors={['#FFFFFF', '#e8f2f8', '#c8e4f5']}
        locations={[0, 0.5, 1]}
        style={[styles.sliderContainer, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Label Reel - Vertical scrolling label list */}
        <View style={styles.labelWindow}>
          {/* Fade overlay at top */}
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'transparent']}
            style={styles.labelFadeTop}
            pointerEvents="none"
          />

          {/* Scrolling label reel */}
          <Animated.View style={[styles.labelReel, labelReelStyle]}>
            {MOOD_STAGES.map((stage, index) => {
              const isActive = index === currentStage;
              return (
                <View key={index} style={styles.labelItem}>
                  <Text
                    style={[
                      styles.labelText,
                      isActive ? styles.labelTextActive : styles.labelTextInactive,
                    ]}
                  >
                    {stage.label}
                  </Text>
                </View>
              );
            })}
          </Animated.View>

          {/* Fade overlay at bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.95)']}
            style={styles.labelFadeBottom}
            pointerEvents="none"
          />
        </View>

        {/* Slider Track */}
        <View style={styles.trackContainer}>
          <View style={styles.track}>
            {/* Dot Indicators - Absolutely positioned at snap points */}
            {MOOD_STAGES.map((_, index) => {
              const isPassed = index < currentStage;
              const isCurrent = index === currentStage;
              const isLast = index === MOOD_STAGES.length - 1;
              // Position dot at center of where thumb would be
              const dotPosition = getSnapPosition(index) + (THUMB_SIZE / 2);
              // Get dot size for centering
              const dotSize = isPassed ? 12 : isLast ? 24 : 18;
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    isPassed && styles.dotPassed,
                    isLast && styles.dotLast,
                    isCurrent && styles.dotCurrent,
                    {
                      position: 'absolute',
                      left: dotPosition - (dotSize / 2),
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Draggable Thumb */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.thumbWrapper, thumbStyle]}>
              <View style={styles.thumb}>
                <View style={styles.thumbDot} />
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </LinearGradient>

      {/* Footer Navigation - Floating on top */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Next Button */}
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonActive]}
          onPress={handleContinue}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Crisis Check Sheet - Shows when user selects "Struggling" */}
      <CrisisCheckSheet
        visible={showCrisisCheck}
        onClose={handleCrisisCheckClose}
        onContinue={handleCrisisCheckContinue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  // Top content area
  topContent: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    fontSize: 32,
    fontFamily: 'Playwrite',
    color: '#1A1A1A',
  },
  progressContainer: {
    marginBottom: 32,
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
  title: {
    fontSize: 32,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    lineHeight: 40,
    marginBottom: 12,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  privacyText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#9E9E9E',
    flex: 1,
    lineHeight: 20,
  },
  // Slider Container - Full width, rounded top only
  sliderContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    paddingHorizontal: SLIDER_HORIZONTAL_PADDING,
    paddingTop: 40,
  },
  // Label Window - The visible "mask" for the reel
  labelWindow: {
    height: LABEL_HEIGHT,
    overflow: 'hidden',
    marginBottom: 20,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#d6d6d6',
    position: 'relative',
  },
  // Label Reel - The scrolling container
  labelReel: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  // Individual label item
  labelItem: {
    height: LABEL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Fade overlays for soft edges
  labelFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 10,
  },
  labelFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 10,
  },
  // Label text styles
  labelText: {
    fontSize: 28,
    fontFamily: 'Outfit-Medium',
    letterSpacing: 0,
  },
  labelTextActive: {
    color: '#6a6a6a',
    opacity: 1,
  },
  labelTextInactive: {
    color: '#b8b7b7',
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  // Track container
  trackContainer: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: '#a4a4a473',
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
  },
  // Dots - absolutely positioned at snap points
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7A7A7A',
    top: (TRACK_HEIGHT - 18) / 2,
    overflow: 'hidden',
  },
  dotPassed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4A4A4A',
    top: (TRACK_HEIGHT - 12) / 2,
    overflow: 'hidden',
  },
  dotCurrent: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  dotLast: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8A8A8A',
    top: (TRACK_HEIGHT - 24) / 2,
    overflow: 'hidden',
  },
  // Thumb
  thumbWrapper: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
    left: 0,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  thumbDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4DA6E8',
  },
  // Footer - floating on transparent background
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  navButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 237, 232, 0.95)',
  },
  navButtonActive: {
    backgroundColor: '#1A1A1A',
  },
  spacer: {
    flex: 1,
  },
});
