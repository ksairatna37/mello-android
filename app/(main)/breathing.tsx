/**
 * Breathing Exercise Screen (Main App)
 * Guided breathing with animated circle
 * Pattern: 4-2-6 (4s inhale, 2s hold, 6s exhale)
 * Cloned from get-rolling/inhale-exhale.tsx with minimal changes
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path, Rect, G, Line, Filter, FeGaussianBlur } from 'react-native-svg';

// Custom Vibration Icon (phone with waves when showWaves=true)
// isSelected controls the color: highlight when selected, muted when not
const VibrationIcon = ({ showWaves = false, isSelected = false, activeColor, inactiveColor }: { showWaves?: boolean; isSelected?: boolean; activeColor?: string; inactiveColor?: string }) => {
  const color = isSelected
    ? (activeColor || '#FFFFFF')
    : (inactiveColor || 'rgba(255,255,255,0.35)');
  return (
    <Svg width={42} height={42} viewBox="-3 0 30 24" fill="none">
      {/* Left waves - only show when showWaves is true */}
      {showWaves && (
        <>
          <Path
            d="M5 14.5C3.8 13.2 3.8 10.8 5 9.5"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <Path
            d="M2 16.5C-0.2 13.8 -0.2 10.2 2 7.5"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.6}
          />
        </>
      )}
      {/* Phone body */}
      <Rect
        x={8}
        y={5}
        width={8}
        height={14}
        rx={2}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      {/* Screen line */}
      <Line x1={10} y1={7.5} x2={14} y2={7.5} stroke={color} strokeWidth={1} opacity={0.5} />
      {/* Right waves - only show when showWaves is true */}
      {showWaves && (
        <>
          <Path
            d="M19 14.5C20.2 13.2 20.2 10.8 19 9.5"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <Path
            d="M22 16.5C24.2 13.8 24.2 10.2 22 7.5"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.6}
          />
        </>
      )}
    </Svg>
  );
};

// Custom Filter/Equalizer Icon (two horizontal sliders)
const FilterIcon = () => {
  const color = 'rgb(255, 255, 255)';
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      {/* Top line */}
      <Line x1={4} y1={8} x2={20} y2={8} stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Top slider dot */}
      <Circle cx={14} cy={8} r={3} fill={color} />
      {/* Bottom line */}
      <Line x1={4} y1={16} x2={20} y2={16} stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Bottom slider dot */}
      <Circle cx={10} cy={16} r={3} fill={color} />
    </Svg>
  );
};

// Nose Icon for Inhale (with inward arrows)
const NoseIcon = () => {
  const color = 'rgba(255, 255, 255, 0.9)';
  return (
    <Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
      {/* Nose bridge */}
      <Path
        d="M16 4C16 4 14 8 14 12C14 16 12 20 10 22C8 24 10 26 12 26C14 26 15 25 16 25C17 25 18 26 20 26C22 26 24 24 22 22C20 20 18 16 18 12C18 8 16 4 16 4Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Left nostril */}
      <Path
        d="M12 23C12 23 13 22 14 22"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      {/* Right nostril */}
      <Path
        d="M20 23C20 23 19 22 18 22"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      {/* Left arrow (pointing inward) */}
      <Path
        d="M4 20L8 18M8 18L6 14M8 18L4 16"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right arrow (pointing inward) */}
      <Path
        d="M28 20L24 18M24 18L26 14M24 18L28 16"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

// Lips Icon for Exhale (with outward arrows)
const LipsIcon = () => {
  const color = 'rgba(255, 255, 255, 0.9)';
  return (
    <Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
      {/* Upper lip */}
      <Path
        d="M6 16C6 16 8 12 12 12C14 12 15 14 16 14C17 14 18 12 20 12C24 12 26 16 26 16"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Lower lip */}
      <Path
        d="M6 16C6 16 8 22 16 22C24 22 26 16 26 16"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Lip line */}
      <Path
        d="M8 16C8 16 12 17 16 17C20 17 24 16 24 16"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.6}
      />
      {/* Left arrow (pointing outward) */}
      <Path
        d="M8 18L4 20M4 20L6 24M4 20L8 22"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right arrow (pointing outward) */}
      <Path
        d="M24 18L28 20M28 20L26 24M28 20L24 22"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

import AuroraGradient from '@/components/common/AuroraGradient';
import AnimatedText from '@/components/get-rolling/AnimatedText';
import { getOnboardingData } from '@/utils/onboardingStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Slider configuration
const SLIDER_WIDTH = SCREEN_WIDTH - 48 - 48; // Screen - sheet padding - container padding
const CYCLE_LABEL_HEIGHT = 56; // Height of each label in the reel
const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

// Soft Teal/Cyan Aurora - Calming Breath Theme
// Lavender-orchid-rose aurora — soft lavender top, pink bloom center, periwinkle cool base
const AURORA_GRADIENT = ['#d4c8ff', '#b9a6ff', '#C9A0E8', '#E27FB0', '#F49AB7', '#9EA9E8'] as const;
const AURORA_LOCATIONS = [0, 0.15, 0.38, 0.58, 0.80, 1] as const;
const AURORA_BLOBS = [
  '#F49AB7', '#b78ce8', '#b9a6ff', '#D4C0E8',  // 0-3: bottom rose, bottom-left lavender, center orchid, left soft
  '#C9B6E4', '#eb93f5', '#b9a6ff', '#7184f1',  // 4-7: upper lavender/violet/periwinkle haze
  '#C4BEE8', '#D0A8D0', '#af86d7', '#D890B8',  // 8-11: corners soft + right-lower orchid-pink
];

// Breathing timing (in ms)
const INHALE_DURATION = 4000;
const HOLD_DURATION = 2000;
const EXHALE_DURATION = 6000;
const CYCLE_DURATION = INHALE_DURATION + HOLD_DURATION + EXHALE_DURATION;

// Circle sizes
const CIRCLE_MIN_SIZE = 160;
const CIRCLE_MAX_SIZE = 250;

type ScreenState =
  | 'intro'
  | 'countdown'
  | 'breathing'
  | 'complete'
  | 'skipped';

type BreathPhase = 'inhale' | 'hold' | 'exhale';

// ============================================================================
// SAFE PERSONALIZATION - Warm presence, not psychology
// ============================================================================

// Default poetic messages (used when no personalization or 'exploring')
const DEFAULT_INHALE = [
  'Draw in peace, let it fill you',
  'Breathe in possibility',
  'Welcome calm into your body',
  'Let stillness enter',
  'Gather your strength gently',
];

const DEFAULT_HOLD = [
  'Hold this moment, you are safe',
  'Rest here, nothing to do',
  'In stillness, find yourself',
  'This pause is yours',
  'Be present, just breathe',
];

const DEFAULT_EXHALE = [
  'Release what no longer serves you',
  'Let go, you are lighter now',
  'Breathe out the weight',
  'Surrender to the exhale',
  'With each breath, you heal',
];

// Anxious: Focus on grounding, calm (not "fixing anxiety")
const ANXIOUS_INHALE = [
  'Let the breath ground you',
  'Steady and slow, you are here',
  'Calm is entering',
  'Each breath brings peace',
  'You are safe in this moment',
];

const ANXIOUS_HOLD = [
  'Rest here, nothing to fix',
  'This stillness is yours',
  'Just be, nothing else',
  'The pause holds you',
  'You are okay right now',
];

const ANXIOUS_EXHALE = [
  'Let the breath soften things',
  'Slow and steady out',
  'Release gently',
  'Let the tension float away',
  'Ease flows out',
];

// Stressed: Focus on release, lightness (not "eliminating stress")
const STRESSED_INHALE = [
  'Breathe in some space',
  'Let air create room',
  'Space is opening up',
  'Room to breathe',
  'Making space inside',
];

const STRESSED_HOLD = [
  'Pause from everything',
  'Nothing to do here',
  'Just this moment',
  'A break is allowed',
  'Rest in the pause',
];

const STRESSED_EXHALE = [
  'Let it go, just for now',
  'Breathe out what you can',
  'Release what you are ready to',
  'Lighter with each breath',
  'You can put it down here',
];

// Lonely: Focus on presence, connection (not "you are not alone")
const LONELY_INHALE = [
  'I am here with you',
  'Breathing together now',
  'We are in this breath',
  'You are accompanied',
  'This breath connects',
];

const LONELY_HOLD = [
  'Held in this moment',
  'Together in stillness',
  'You are not breathing alone',
  'Present with you',
  'We pause together',
];

const LONELY_EXHALE = [
  'Letting go, together',
  'Breathing out as one',
  'Connected in release',
  'We exhale together',
  'Shared breath, shared calm',
];

// High intensity (struggling): Extra gentle, simple, reassuring
const GENTLE_INHALE = [
  'Just this breath',
  'Slowly, gently in',
  'One breath at a time',
  'Easy does it',
  'Soft breath in',
];

const GENTLE_HOLD = [
  'You are doing well',
  'Rest here',
  'Just be',
  'This is enough',
  'You are okay',
];

const GENTLE_EXHALE = [
  'Gently out',
  'Let it go easy',
  'Soft release',
  'No rush',
  'Just let it flow out',
];

// Message sets by feeling
type MessageSet = {
  inhale: string[];
  hold: string[];
  exhale: string[];
};

const MESSAGE_SETS: Record<string, MessageSet> = {
  anxious: { inhale: ANXIOUS_INHALE, hold: ANXIOUS_HOLD, exhale: ANXIOUS_EXHALE },
  stressed: { inhale: STRESSED_INHALE, hold: STRESSED_HOLD, exhale: STRESSED_EXHALE },
  lonely: { inhale: LONELY_INHALE, hold: LONELY_HOLD, exhale: LONELY_EXHALE },
  burnout: { inhale: STRESSED_INHALE, hold: STRESSED_HOLD, exhale: STRESSED_EXHALE }, // Similar to stressed
  default: { inhale: DEFAULT_INHALE, hold: DEFAULT_HOLD, exhale: DEFAULT_EXHALE },
};

// Gentle set for high intensity users (moodIntensity >= 2)
const GENTLE_SET: MessageSet = {
  inhale: GENTLE_INHALE,
  hold: GENTLE_HOLD,
  exhale: GENTLE_EXHALE,
};

// Encouraging messages for skipped state
const SKIPPED_MESSAGES = [
  "That's okay, you showed up. Sometimes just being here is the bravest step.",
  "No pressure, no judgment. Your breath will wait for you whenever you're ready.",
  "It takes courage to pause. You're already doing something beautiful.",
  "Even one breath counts. You've planted a seed of calm within you.",
  "This moment of trying is a gift to yourself. Be proud you began.",
  "Don't worry about doing it 'right' - just doing it at all is a win. Your breath is your ally, not a taskmaster.",
  "You are not alone in this. Many have felt the same hesitation. It’s okay to take it slow.",
  "Your worth is not measured by how many breaths you take, but by the courage it takes to try. You are enough.",
  "The fact that you even considered doing this is a sign of your strength. Be gentle with yourself, and know that you can return to this moment whenever you need.",
  "Remember, the breath is always with you, even if you choose not to engage with it right now. It’s a source of comfort and calm that you can access in your own time. You are doing great just by being here.",
  "Don't blame yourself for feeling hesitant. The fact that you want to do this shows your desire for growth and calm. Be proud of yourself for taking the first step, even if it feels small.But remember to continue",
];

// Wrapper that remounts the screen on re-entry (fresh state each visit)
export default function BreathingScreenWrapper() {
  const [key, setKey] = useState(0);
  const isFirstMount = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      setKey((k) => k + 1);
    }, [])
  );

  return <BreathingScreen key={key} />;
}

function BreathingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('intro');
  const [countdown, setCountdown] = useState(3);
  const [currentPhase, setCurrentPhase] = useState<BreathPhase>('inhale');
  const [cycleCount, setCycleCount] = useState(0);

  // Personalization state
  const [activeMessageSet, setActiveMessageSet] = useState<MessageSet>(MESSAGE_SETS.default);
  const [firstName, setFirstName] = useState<string>('');

  // Load personalization from onboarding data
  useEffect(() => {
    const loadPersonalization = async () => {
      const data = await getOnboardingData();

      if (data.firstName) {
        setFirstName(data.firstName);
      }

      // High intensity users get gentle messages (priority)
      if (data.moodIntensity !== undefined && data.moodIntensity >= 2) {
        setActiveMessageSet(GENTLE_SET);
        return;
      }

      // Otherwise, personalize by primary feeling
      if (data.selectedFeelings && data.selectedFeelings.length > 0) {
        const primaryFeeling = data.selectedFeelings[0];
        if (MESSAGE_SETS[primaryFeeling]) {
          setActiveMessageSet(MESSAGE_SETS[primaryFeeling]);
          return;
        }
      }

      // Default messages
      setActiveMessageSet(MESSAGE_SETS.default);
    };

    loadPersonalization();
  }, []);
  const [totalCycles, setTotalCycles] = useState(3);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [showCustomization, setShowCustomization] = useState(false);
  const [tempCycles, setTempCycles] = useState(3);

  // Refs for timing
  const breathingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseStartTimeRef = useRef<number>(0);

  // Animation values
  const circleScale = useSharedValue(1);
  const circleMiddleScale = useSharedValue(1); // Separate scale for faster middle fill animation
  const glowOpacity = useSharedValue(0.5);
  const glowRotation = useSharedValue(0);
  const introOpacity = useSharedValue(1);
  const countdownOpacity = useSharedValue(0);
  const breathingOpacity = useSharedValue(0);
  const completeOpacity = useSharedValue(0);
  const skippedOpacity = useSharedValue(0);
  const longPressTextOpacity = useSharedValue(0);
  const longPressTextTranslateY = useSharedValue(30);

  // Button entrance animations
  const startButtonTranslateY = useSharedValue(80);
  const startButtonOpacity = useSharedValue(0);
  const leftButtonTranslateX = useSharedValue(-60);
  const leftButtonOpacity = useSharedValue(0);
  const rightButtonTranslateX = useSharedValue(60);
  const rightButtonOpacity = useSharedValue(0);

  // Bottom sheet animations
  const sheetTranslateY = useSharedValue(400);
  const overlayOpacity = useSharedValue(0);

  // Cycle slider shared values
  const sliderStartX = useSharedValue(0);
  const currentCycleShared = useSharedValue(3); // Track on UI thread (value 1-5)
  const cycleLabelY = useSharedValue(-2 * CYCLE_LABEL_HEIGHT); // Start at 3 (index 2)

  // Sync slider stage to JS state
  const syncCycleToJS = useCallback((newCycleValue: number) => {
    setTempCycles(newCycleValue);
    Vibration.vibrate(Platform.OS === 'ios' ? 50 : 70);
  }, []);

  // Pan gesture for cycle slider - horizontal drag across ticks
  const cyclePanGesture = Gesture.Pan()
    .onStart((event) => {
      'worklet';
      sliderStartX.value = event.x;
    })
    .onUpdate((event) => {
      'worklet';
      // Calculate which tick we're at based on x position
      const trackWidth = SLIDER_WIDTH - 40; // Account for padding
      const normalizedX = Math.max(0, Math.min(event.x, trackWidth));
      const progress = normalizedX / trackWidth;

      // Smooth continuous label scroll based on drag position
      cycleLabelY.value = -progress * 4 * CYCLE_LABEL_HEIGHT;

      const cycleValue = Math.round(progress * 4) + 1; // 1 to 5
      const clampedCycle = Math.max(1, Math.min(5, cycleValue));

      if (clampedCycle !== currentCycleShared.value) {
        currentCycleShared.value = clampedCycle;
        runOnJS(syncCycleToJS)(clampedCycle);
      }
    })
    .onEnd(() => {
      'worklet';
      // Snap label to nearest value
      const targetY = -(currentCycleShared.value - 1) * CYCLE_LABEL_HEIGHT;
      cycleLabelY.value = withTiming(targetY, {
        duration: 200,
        easing: EASE_OUT,
      });
    });

  // Label reel animated style
  const cycleLabelReelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cycleLabelY.value }],
  }));

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (breathingTimerRef.current) {
        clearTimeout(breathingTimerRef.current);
      }
    };
  }, []);

  // Start the wavy glow rotation animation
  useEffect(() => {
    glowRotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  // Button entrance animations (after title animation completes)
  useEffect(() => {
    // Title animation takes ~3 seconds (8 words * ~350ms each)
    // After title completes + 1.5 second delay, animate start button
    const startButtonTimer = setTimeout(() => {
      startButtonOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) });
      startButtonTranslateY.value = withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) });
    }, 1500);

    // After start button + 2 seconds, animate side buttons
    const sideButtonsTimer = setTimeout(() => {
      // Vibration button slides in from left
      leftButtonOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) });
      leftButtonTranslateX.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.ease) });
      // Filter button slides in from right
      rightButtonOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) });
      rightButtonTranslateX.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.ease) });
    }, 2500);

    return () => {
      clearTimeout(startButtonTimer);
      clearTimeout(sideButtonsTimer);
    };
  }, []);

  // Trigger haptic feedback
  const triggerHaptic = useCallback(() => {
    if (vibrationEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [vibrationEnabled]);

  // Handle phase transitions during breathing
  const runBreathingCycle = useCallback((cycle: number) => {
    if (cycle >= totalCycles) {
      // Breathing complete
      setScreenState('complete');
      breathingOpacity.value = withTiming(0, { duration: 400 });
      completeOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
      return;
    }

    // Inhale phase
    setCurrentPhase('inhale');
    setCycleCount(cycle);
    triggerHaptic();
    // Middle fill animates at normal pace
    circleMiddleScale.value = withTiming(CIRCLE_MAX_SIZE / CIRCLE_MIN_SIZE, {
      duration: INHALE_DURATION,
      easing: Easing.inOut(Easing.ease),
    });

    breathingTimerRef.current = setTimeout(() => {
      // Hold phase
      setCurrentPhase('hold');
      triggerHaptic();

      breathingTimerRef.current = setTimeout(() => {
        // Exhale phase
        setCurrentPhase('exhale');
        triggerHaptic();
        // Middle fill animates at normal pace
        circleMiddleScale.value = withTiming(1, {
          duration: EXHALE_DURATION,
          easing: Easing.inOut(Easing.ease),
        });

        breathingTimerRef.current = setTimeout(() => {
          // Next cycle
          runBreathingCycle(cycle + 1);
        }, EXHALE_DURATION);
      }, HOLD_DURATION);
    }, INHALE_DURATION);
  }, [totalCycles, triggerHaptic, circleScale, breathingOpacity, completeOpacity]);

  // Start countdown sequence (with 2 second delay before countdown appears)
  const startCountdown = useCallback(() => {
    setScreenState('countdown');
    introOpacity.value = withTiming(0, { duration: 400 });

    // 2 second delay before countdown elements mount
    setTimeout(() => {
      countdownOpacity.value = withTiming(1, { duration: 400 });

      let count = 3;
      setCountdown(count);
      triggerHaptic();

      const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
          setCountdown(count);
          triggerHaptic();
        } else {
          clearInterval(countdownInterval);
          // Start breathing
          setScreenState('breathing');
          countdownOpacity.value = withTiming(0, { duration: 400 });
          breathingOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
          setTimeout(() => runBreathingCycle(0), 800);
          // Slide up "long press to end" text after 3 seconds
          setTimeout(() => {
            longPressTextOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
            longPressTextTranslateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
          }, 3000);
        }
      }, 1000);
    }, 3000);
  }, [introOpacity, countdownOpacity, breathingOpacity, triggerHaptic, runBreathingCycle]);

  // Handle Start button press with exit animations
  const handleStart = () => {
    // First: Side buttons exit (slide out and fade)
    leftButtonOpacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) });
    leftButtonTranslateX.value = withTiming(-60, { duration: 400, easing: Easing.in(Easing.cubic) });
    rightButtonOpacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) });
    rightButtonTranslateX.value = withTiming(60, { duration: 400, easing: Easing.in(Easing.cubic) });

    // Then: Start button slides down (after side buttons start exiting)
    setTimeout(() => {
      startButtonOpacity.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) });
      startButtonTranslateY.value = withTiming(80, { duration: 500, easing: Easing.in(Easing.cubic) });
    }, 200);

    // Start countdown after all exit animations
    setTimeout(() => {
      startCountdown();
    }, 600);
  };

  // Navigation - go back to previous screen
  const handleNext = () => router.back();
  const handleClose = () => router.back();

  // Handle long press to skip/end breathing
  const handleLongPressSkip = () => {
    // Clear any running timers
    if (breathingTimerRef.current) {
      clearTimeout(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Hide the long press text
    longPressTextOpacity.value = withTiming(0, { duration: 200 });
    // Transition to skipped state
    setScreenState('skipped');
    breathingOpacity.value = withTiming(0, { duration: 400 });
    skippedOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
  };

  // Get random skipped message
  const getSkippedMessage = () => {
    const randomIndex = Math.floor(Math.random() * SKIPPED_MESSAGES.length);
    return SKIPPED_MESSAGES[randomIndex];
  };

  // Get current poetic message (personalized based on user's feelings/intensity)
  const getCurrentMessage = () => {
    const messageIndex = cycleCount % 5;
    switch (currentPhase) {
      case 'inhale':
        return activeMessageSet.inhale[messageIndex];
      case 'hold':
        return activeMessageSet.hold[messageIndex];
      case 'exhale':
        return activeMessageSet.exhale[messageIndex];
    }
  };

  // Get countdown instruction text (short, readable in 1 second)
  const getCountdownText = () => {
    switch (countdown) {
      case 3:
        return 'Inhale';
      case 2:
        return 'Hold';
      case 1:
        return 'Exhale';
      default:
        return '';
    }
  };

  // Calculate total breathing time
  const getTotalTime = () => {
    const seconds = (cycleCount * CYCLE_DURATION) / 1000;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  // Animated styles
  const circleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));

  // Faster animation for middle fill circle
  const circleMiddleFillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleMiddleScale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${glowRotation.value}deg` }],
    opacity: interpolate(circleScale.value, [1, CIRCLE_MAX_SIZE / CIRCLE_MIN_SIZE], [0.4, 0.8]),
  }));

  const introAnimatedStyle = useAnimatedStyle(() => ({
    opacity: introOpacity.value,
  }));

  const countdownAnimatedStyle = useAnimatedStyle(() => ({
    opacity: countdownOpacity.value,
  }));

  const breathingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: breathingOpacity.value,
  }));

  const completeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: completeOpacity.value,
  }));

  const skippedAnimatedStyle = useAnimatedStyle(() => ({
    opacity: skippedOpacity.value,
  }));

  const longPressTextAnimatedStyle = useAnimatedStyle(() => ({
    opacity: longPressTextOpacity.value,
    transform: [{ translateY: longPressTextTranslateY.value }],
  }));

  // Button entrance animated styles
  const startButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: startButtonOpacity.value,
    transform: [{ translateY: startButtonTranslateY.value }],
  }));

  const leftButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: leftButtonOpacity.value,
    transform: [{ translateX: leftButtonTranslateX.value }],
  }));

  const rightButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rightButtonOpacity.value,
    transform: [{ translateX: rightButtonTranslateX.value }],
  }));

  // Bottom sheet animated styles
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  // Customization bottom sheet handlers
  const openCustomization = () => {
    setTempCycles(totalCycles);
    currentCycleShared.value = totalCycles;
    // Reset label position to current value
    cycleLabelY.value = -(totalCycles - 1) * CYCLE_LABEL_HEIGHT;
    setShowCustomization(true);
    overlayOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    sheetTranslateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
  };

  const closeCustomization = () => {
    overlayOpacity.value = withTiming(0, { duration: 250, easing: Easing.in(Easing.ease) });
    sheetTranslateY.value = withTiming(400, { duration: 300, easing: Easing.in(Easing.cubic) });
    setTimeout(() => setShowCustomization(false), 300);
  };

  const saveCustomization = () => {
    setTotalCycles(tempCycles);
    closeCustomization();
  };

  return (
    <View style={styles.container}>
      <AuroraGradient
        gradientColors={AURORA_GRADIENT}
        gradientLocations={AURORA_LOCATIONS}
        blobColors={AURORA_BLOBS}
      />

      <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
        {/* Header - Close button (hidden on complete/skipped states) */}
        {screenState !== 'complete' && screenState !== 'skipped' && (
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={28} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        )}

        {/* Intro State */}
        {screenState === 'intro' && (
          <Animated.View style={[styles.introContainer, introAnimatedStyle]}>
            <View style={styles.textSection}>
              <Text style={styles.subtitle}>
                You chose to pause{'\n'}That takes strength
              </Text>
              <AnimatedText
                text="Close your eyes. Let the world wait. This moment is yours."
                style={styles.title}
                activeColor="#FFFFFF"
                delayPerWord={100}
                wordDuration={250}
              />
            </View>

            {/* Bottom Controls */}
            <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
              <Animated.View style={leftButtonAnimatedStyle}>
                <TouchableOpacity
                  style={[styles.controlButton, vibrationEnabled && styles.controlButtonActive]}
                  onPress={() => {
                    const newValue = !vibrationEnabled;
                    setVibrationEnabled(newValue);
                    if (newValue) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  <VibrationIcon showWaves={vibrationEnabled} isSelected={vibrationEnabled} />
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={startButtonAnimatedStyle}>
                <View style={styles.startButtonWrapper}>
                  <Svg width={160} height={160} style={styles.startButtonGlow}>
                    <Defs>
                      <Filter id="blurFilter" x="-100%" y="-100%" width="300%" height="300%">
                        <FeGaussianBlur in="SourceGraphic" stdDeviation="18" />
                      </Filter>
                      <RadialGradient id="startGlow" cx="50%" cy="50%" r="50%">
                        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                        <Stop offset="70%" stopColor="#E27FB0" stopOpacity="0.5" />
                        <Stop offset="100%" stopColor="#E27FB0" stopOpacity="0" />
                      </RadialGradient>
                    </Defs>
                    <Circle cx="80" cy="80" r="70" fill="url(#startGlow)" filter="url(#blurFilter)" />
                  </Svg>
                  <TouchableOpacity style={styles.startButton} onPress={handleStart}>
                    <Text style={styles.startButtonText}>Start</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              <Animated.View style={rightButtonAnimatedStyle}>
                <TouchableOpacity style={styles.controlButton} onPress={openCustomization}>
                  <FilterIcon />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        )}

        {/* Countdown State */}
        {screenState === 'countdown' && (
          <Animated.View style={[styles.centerContainer, countdownAnimatedStyle]}>
            <View style={styles.breathingCircleContainer}>
              <View style={styles.circleOuterRing} />
              <View style={styles.circleInnerSolid}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
              </View>
            </View>
            <Text style={styles.countdownText}>{getCountdownText()}</Text>
          </Animated.View>
        )}

        {/* Breathing State */}
        {screenState === 'breathing' && (
          <Animated.View style={[styles.centerContainer, breathingAnimatedStyle]}>
            {/* Breathing Pattern Indicator */}
            {/* <View style={styles.patternIndicator}>
              <View style={styles.patternItem}>
                <NoseIcon />
                <Text style={styles.patternNumber}>4</Text>
              </View>
              <View style={styles.patternItem}>
                <LipsIcon />
                <Text style={styles.patternNumber}>6</Text>
              </View>
            </View> */}

            {/* Animated Breathing Circle */}
            <View style={styles.breathingCircleContainer}>
              {/* Outer ring - static at max size */}
              <View style={styles.circleOuterRing} />
              {/* Middle fill area - animates */}
              <Animated.View style={[styles.circleMiddleFill, circleMiddleFillAnimatedStyle]} />
              {/* Inner solid circle with text */}
              <View style={styles.circleInnerSolid}>
                <Text style={styles.phaseText}>
                  {currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)}
                </Text>
              </View>
            </View>

            {/* Poetic Subtitle */}
            <Text style={styles.poeticMessage}>{getCurrentMessage()}</Text>

            {/* Long Press to End - Lower screen area */}
            <TouchableOpacity
              style={styles.longPressArea}
              onLongPress={handleLongPressSkip}
              delayLongPress={1500}
              activeOpacity={1}
            >
              <Animated.Text style={[styles.longPressText, longPressTextAnimatedStyle]}>
                long press to end
              </Animated.Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Skipped State */}
        {screenState === 'skipped' && (
          <Animated.View style={[styles.completeContainer, skippedAnimatedStyle]}>
            <Text style={styles.completeSubtitle}>
              No pressure, ever
            </Text>
            <AnimatedText
              text={getSkippedMessage()}
              style={styles.completeTitle}
              activeColor="#FFFFFF"
              delayPerWord={100}
              wordDuration={250}
            />

            <View style={[styles.nextButtonContainer, { paddingBottom: insets.bottom + 20 }]}>
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Ionicons name="arrow-forward" size={28} color="#5B48A2" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Complete State */}
        {screenState === 'complete' && (
          <Animated.View style={[styles.completeContainer, completeAnimatedStyle]}>
            <Text style={styles.completeSubtitle}>
              You showed up for yourself
            </Text>
            <AnimatedText
              text="That stillness lives in you. Come back whenever you need it."
              style={styles.completeTitle}
              activeColor="#FFFFFF"
              delayPerWord={80}
              wordDuration={200}
            />

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalCycles}</Text>
                <Text style={styles.statLabel}>cycles</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.round((totalCycles * CYCLE_DURATION) / 1000)}s</Text>
                <Text style={styles.statLabel}>of calm</Text>
              </View>
            </View>

            <View style={[styles.nextButtonContainer, { paddingBottom: insets.bottom + 20 }]}>
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Ionicons name="arrow-forward" size={28} color="#5B48A2" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Customization Bottom Sheet */}
      {showCustomization && (
        <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={closeCustomization}
          />
          <Animated.View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }, sheetAnimatedStyle]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Customization</Text>

            {/* Vibration Toggle */}
            <Text style={styles.sheetSectionTitle}>Vibration</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleOption, vibrationEnabled && styles.toggleOptionActive]}
                onPress={() => {
                  setVibrationEnabled(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <VibrationIcon showWaves={true} isSelected={vibrationEnabled} />
                <Text style={[styles.toggleText, vibrationEnabled && styles.toggleTextActive]}>On</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleOption, !vibrationEnabled && styles.toggleOptionActive]}
                onPress={() => setVibrationEnabled(false)}
              >
                <VibrationIcon showWaves={false} isSelected={!vibrationEnabled} />
                <Text style={[styles.toggleText, !vibrationEnabled && styles.toggleTextActive]}>Off</Text>
              </TouchableOpacity>
            </View>

            {/* Breathing Cycle Slider */}
            <Text style={styles.sheetSectionTitle}>Breathing cycle</Text>
            <View style={styles.sliderContainer}>
              {/* Animated label reel */}
              <View style={styles.labelWindow}>
                <Animated.View style={[styles.labelReel, cycleLabelReelStyle]}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <View key={num} style={styles.labelItem}>
                      <Text style={[
                        styles.sliderValue,
                        num === tempCycles ? styles.labelActive : styles.labelInactive
                      ]}>
                        {num}
                      </Text>
                    </View>
                  ))}
                </Animated.View>
                {/* Soft blur fade at top */}
                <LinearGradient
                  colors={['rgba(162,143,232,1)', 'rgba(162,143,232,0)']}
                  style={styles.labelFadeTop}
                  pointerEvents="none"
                />
                {/* Soft blur fade at bottom */}
                <LinearGradient
                  colors={['rgba(162,143,232,0)', 'rgba(162,143,232,1)']}
                  style={styles.labelFadeBottom}
                  pointerEvents="none"
                />
              </View>

              {/* Draggable tick track */}
              <GestureDetector gesture={cyclePanGesture}>
                <Animated.View style={styles.sliderTrack}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <View
                      key={num}
                      style={[
                        styles.sliderTick,
                        num === tempCycles && styles.sliderTickActive,
                      ]}
                    />
                  ))}
                </Animated.View>
              </GestureDetector>
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={saveCustomization}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    zIndex: 10,
  },
  closeButton: { width: 48, height: 48, justifyContent: 'center' },
  progressContainer: { flex: 1, paddingHorizontal: 12 },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#b9a6ff', borderRadius: 4 },
  stepText: { fontSize: 17, fontFamily: 'Outfit-SemiBold', color: '#FFF', minWidth: 60, textAlign: 'right' },
  stepTextLight: { fontFamily: 'Outfit-Regular', color: 'rgba(255,255,255,0.7)' },

  // Intro State
  introContainer: { flex: 1 },
  textSection: { flex: 1, paddingTop: 20 },
  subtitle: {
    fontSize: 17,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
    lineHeight: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
    lineHeight: 42,
  },

  // Bottom Controls
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 25,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  startButtonWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonGlow: {
    position: 'absolute',
  },
  startButton: {
    width: 120,
    height: 120,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 20,
    fontFamily: 'Outfit-SemiBold',
    color: '#5B48A2',
  },

  // Center Container (Countdown & Breathing)
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -60,
  },

  // Breathing Pattern Indicator
  patternIndicator: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30,18,40,0.35)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 24,
    marginBottom: 60,
  },
  patternItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  patternNumber: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFF',
  },

  // Breathing Circle
  breathingCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: CIRCLE_MAX_SIZE + 80,
    height: CIRCLE_MAX_SIZE + 80,
  },
  // Outer ring - static at max size
  circleOuterRing: {
    position: 'absolute',
    width: CIRCLE_MAX_SIZE ,
    height: CIRCLE_MAX_SIZE ,
    borderRadius: (CIRCLE_MAX_SIZE + 40) / 2,
    // borderWidth: 2,
    // borderColor: 'rgba(120, 140, 160, 0.4)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  // Middle fill area - semi-transparent
  circleMiddleFill: {
    position: 'absolute',
    width: CIRCLE_MIN_SIZE - 30,
    height: CIRCLE_MIN_SIZE - 30,
    borderRadius: (CIRCLE_MIN_SIZE - 10) / 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  // Inner solid circle with text
  circleInnerSolid: {
    width: 100,
    height: 100,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  countdownNumber: {
    fontSize: 48,
    fontFamily: 'Outfit-Light',
    color: '#FFFFFF',
  },
  countdownText: {
    fontSize: 22,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    marginTop: 40,
    textAlign: 'center',
  },
  phaseText: {
    fontSize: 20,
    fontFamily: 'Outfit-Medium',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  poeticMessage: {
    fontSize: 20,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    marginTop: 50,
    textAlign: 'center',
    paddingHorizontal: 20,
    minHeight: 60,
  },
  longPressArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  longPressText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.5)',
  },

  // Complete State
  completeContainer: {
    flex: 1,
    paddingTop: 40,
  },
  completeSubtitle: {
    fontSize: 17,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  completeTitle: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
    lineHeight: 38,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    gap: 30,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 36,
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  nextButtonContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  nextButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom Sheet
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(55,42,100,0.55)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheet: {
    backgroundColor: 'rgb(185, 166, 255)',
    borderRadius: 32,
    padding: 24,
    marginHorizontal: 10,
    marginBottom: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  sheetSectionTitle: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(91,72,162,0.25)',
    borderRadius: 25,
    padding: 10,
    marginBottom: 24,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 20,
    gap: 2,
  },
  toggleOptionActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  toggleText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255,255,255,0.45)',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  sliderContainer: {
    backgroundColor: 'rgba(91,72,162,0.25)',
    borderRadius: 25,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  // Label window (visible mask for the scrolling reel)
  labelWindow: {
    height: CYCLE_LABEL_HEIGHT,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },
  labelReel: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  labelItem: {
    height: CYCLE_LABEL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    zIndex: 10,
  },
  labelFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 10,
    zIndex: 10,
  },
  sliderValue: {
    fontSize: 48,
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
  },
  labelActive: {
    opacity: 1,
  },
  labelInactive: {
    opacity: 0.3,
    transform: [{ scale: 0.85 }],
  },
  sliderTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sliderTick: {
    width: 8,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
  },
  sliderTickActive: {
    height: 32,
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#5B48A2',
  },
});
