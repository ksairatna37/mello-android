/**
 * Get Rolling - Inhale-Exhale Breathing Exercise Screen
 * Step 7 of 8 - Guided breathing with animated circle
 * Pattern: 4-2-6 (4s inhale, 2s hold, 6s exhale)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path, Rect, G, Line, Filter, FeGaussianBlur } from 'react-native-svg';

// Custom Vibration Icon (phone with waves)
const VibrationIcon = ({ active = false }: { active?: boolean }) => {
  const color = active ? '#50B8B8' : 'rgba(255,255,255,0.6)';
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      {/* Left waves */}
      <Path
        d="M4 15C2.5 13.5 2.5 10.5 4 9"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M1 17C-1.5 14 -1.5 10 1 7"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.6}
      />
      {/* Phone body */}
      <Rect
        x={7}
        y={4}
        width={10}
        height={16}
        rx={2}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      {/* Screen line */}
      <Line x1={9} y1={7} x2={15} y2={7} stroke={color} strokeWidth={1} opacity={0.5} />
      {/* Right waves */}
      <Path
        d="M20 15C21.5 13.5 21.5 10.5 20 9"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M23 17C25.5 14 25.5 10 23 7"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.6}
      />
    </Svg>
  );
};

// Custom Filter/Equalizer Icon (two horizontal sliders)
const FilterIcon = () => {
  const color = 'rgba(255,255,255,0.6)';
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
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

import AuroraGradient from '@/components/common/AuroraGradient';
import AnimatedText from '@/components/get-rolling/AnimatedText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Soft Teal/Cyan Aurora - Calming Breath Theme
const AURORA_GRADIENT = ['#E0F8F8', '#B8E8E8', '#68B8B8', '#285858', '#102028', '#80D0D8'] as const;
const AURORA_LOCATIONS = [0, 0.15, 0.38, 0.58, 0.82, 1] as const;
const AURORA_BLOBS = [
  '#081418', '#0C1C20', '#1C3840', '#388888',
  '#88D8D8', '#C0F0F0', '#A0E0E0', '#E0F8F8',
  '#F0FCFC', '#50A8B0', '#386068', '#102028',
];

// Breathing timing (in ms)
const INHALE_DURATION = 4000;
const HOLD_DURATION = 2000;
const EXHALE_DURATION = 6000;
const CYCLE_DURATION = INHALE_DURATION + HOLD_DURATION + EXHALE_DURATION;

// Circle sizes
const CIRCLE_MIN_SIZE = 140;
const CIRCLE_MAX_SIZE = 200;

type ScreenState =
  | 'intro'
  | 'countdown'
  | 'breathing'
  | 'complete';

type BreathPhase = 'inhale' | 'hold' | 'exhale';

const TOTAL_STEPS = 8;
const CURRENT_STEP = 7;

// Poetic messages for each phase (rotate through cycles)
const INHALE_MESSAGES = [
  'Draw in peace, let it fill you',
  'Breathe in possibility',
  'Welcome calm into your body',
  'Let stillness enter',
  'Gather your strength gently',
];

const HOLD_MESSAGES = [
  'Hold this moment, you are safe',
  'Rest here, nothing to do',
  'In stillness, find yourself',
  'This pause is yours',
  'Be present, just breathe',
];

const EXHALE_MESSAGES = [
  'Release what no longer serves you',
  'Let go, you are lighter now',
  'Breathe out the weight',
  'Surrender to the exhale',
  'With each breath, you heal',
];

export default function InhaleExhaleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('intro');
  const [countdown, setCountdown] = useState(3);
  const [currentPhase, setCurrentPhase] = useState<BreathPhase>('inhale');
  const [cycleCount, setCycleCount] = useState(0);
  const [totalCycles, setTotalCycles] = useState(3);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [showCustomization, setShowCustomization] = useState(false);
  const [tempCycles, setTempCycles] = useState(3);

  // Refs for timing
  const breathingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseStartTimeRef = useRef<number>(0);

  // Animation values
  const circleScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);
  const glowRotation = useSharedValue(0);
  const introOpacity = useSharedValue(1);
  const countdownOpacity = useSharedValue(0);
  const breathingOpacity = useSharedValue(0);
  const completeOpacity = useSharedValue(0);

  // Button entrance animations
  const startButtonTranslateY = useSharedValue(80);
  const startButtonOpacity = useSharedValue(0);
  const leftButtonTranslateX = useSharedValue(-60);
  const leftButtonOpacity = useSharedValue(0);
  const rightButtonTranslateX = useSharedValue(60);
  const rightButtonOpacity = useSharedValue(0);

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    circleScale.value = withTiming(CIRCLE_MAX_SIZE / CIRCLE_MIN_SIZE, {
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
        circleScale.value = withTiming(1, {
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

  // Start countdown sequence
  const startCountdown = useCallback(() => {
    setScreenState('countdown');
    introOpacity.value = withTiming(0, { duration: 400 });
    countdownOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));

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
      }
    }, 1000);
  }, [introOpacity, countdownOpacity, breathingOpacity, triggerHaptic, runBreathingCycle]);

  // Handle Start button press
  const handleStart = () => {
    startCountdown();
  };

  // Navigation
  const handleNext = () => router.push('/(get-rolling)/insight');
  const handleClose = () => router.replace('/(main)/chat');

  // Get current poetic message
  const getCurrentMessage = () => {
    const messageIndex = cycleCount % 5;
    switch (currentPhase) {
      case 'inhale':
        return INHALE_MESSAGES[messageIndex];
      case 'hold':
        return HOLD_MESSAGES[messageIndex];
      case 'exhale':
        return EXHALE_MESSAGES[messageIndex];
    }
  };

  // Get countdown instruction text
  const getCountdownText = () => {
    switch (countdown) {
      case 3:
        return 'inhale through the nose';
      case 2:
        return 'hold the breath';
      case 1:
        return 'then exhale through the mouth';
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

  // Customization bottom sheet handlers
  const openCustomization = () => {
    setTempCycles(totalCycles);
    setShowCustomization(true);
  };

  const saveCustomization = () => {
    setTotalCycles(tempCycles);
    setShowCustomization(false);
  };

  return (
    <View style={styles.container}>
      <AuroraGradient
        gradientColors={AURORA_GRADIENT}
        gradientLocations={AURORA_LOCATIONS}
        blobColors={AURORA_BLOBS}
      />

      <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%` }]} />
            </View>
          </View>

          <Text style={styles.stepText}>
            {CURRENT_STEP} <Text style={styles.stepTextLight}>of {TOTAL_STEPS}</Text>
          </Text>
        </View>

        {/* Intro State */}
        {screenState === 'intro' && (
          <Animated.View style={[styles.introContainer, introAnimatedStyle]}>
            <View style={styles.textSection}>
              <Text style={styles.subtitle}>
                I am personalising the{'\n'}experience for you! Hold a moment
              </Text>
              <AnimatedText
                text="You're doing beautifully. Let's take a breath together."
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
                  onPress={() => setVibrationEnabled(!vibrationEnabled)}
                >
                  <VibrationIcon active={vibrationEnabled} />
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
                        <Stop offset="70%" stopColor="#80D0D8" stopOpacity="0.5" />
                        <Stop offset="100%" stopColor="#80D0D8" stopOpacity="0" />
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
            <View style={styles.breathingCircle}>
              <View style={styles.circleInner}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
              </View>
              <View style={styles.circleGlow} />
            </View>
            <Text style={styles.countdownText}>{getCountdownText()}</Text>
          </Animated.View>
        )}

        {/* Breathing State */}
        {screenState === 'breathing' && (
          <Animated.View style={[styles.centerContainer, breathingAnimatedStyle]}>
            {/* Breathing Pattern Indicator */}
            <View style={styles.patternIndicator}>
              <View style={styles.patternItem}>
                <Text style={styles.patternIcon}>👃</Text>
                <Text style={styles.patternNumber}>4</Text>
              </View>
              <View style={styles.patternItem}>
                <Text style={styles.patternIcon}>👄</Text>
                <Text style={styles.patternNumber}>6</Text>
              </View>
            </View>

            {/* Animated Breathing Circle */}
            <View style={styles.breathingCircleContainer}>
              <Animated.View style={[styles.circleGlowOuter, glowAnimatedStyle]} />
              <Animated.View style={[styles.breathingCircle, circleAnimatedStyle]}>
                <View style={styles.circleInner}>
                  <Text style={styles.phaseText}>{currentPhase}</Text>
                </View>
              </Animated.View>
            </View>

            {/* Poetic Subtitle */}
            <Text style={styles.poeticMessage}>{getCurrentMessage()}</Text>
          </Animated.View>
        )}

        {/* Complete State */}
        {screenState === 'complete' && (
          <Animated.View style={[styles.completeContainer, completeAnimatedStyle]}>
            <Text style={styles.completeSubtitle}>
              You did it, beautiful soul
            </Text>
            <AnimatedText
              text="Your nervous system just got a gentle reset. Deep breathing activates your parasympathetic response, lowering cortisol and inviting calm."
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
                <Ionicons name="arrow-forward" size={28} color="#1A3030" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Customization Bottom Sheet */}
      {showCustomization && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowCustomization(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Customization</Text>

            {/* Vibration Toggle */}
            <Text style={styles.sheetSectionTitle}>Vibration</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleOption, vibrationEnabled && styles.toggleOptionActive]}
                onPress={() => setVibrationEnabled(true)}
              >
                <VibrationIcon active={vibrationEnabled} />
                <Text style={[styles.toggleText, vibrationEnabled && styles.toggleTextActive]}>On</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleOption, !vibrationEnabled && styles.toggleOptionActive]}
                onPress={() => setVibrationEnabled(false)}
              >
                <VibrationIcon active={!vibrationEnabled} />
                <Text style={[styles.toggleText, !vibrationEnabled && styles.toggleTextActive]}>Off</Text>
              </TouchableOpacity>
            </View>

            {/* Breathing Cycle Slider */}
            <Text style={styles.sheetSectionTitle}>breathing cycle</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderValue}>{tempCycles}</Text>
              <View style={styles.sliderTrack}>
                {[1, 2, 3, 4, 5].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.sliderTick, num === tempCycles && styles.sliderTickActive]}
                    onPress={() => setTempCycles(num)}
                  />
                ))}
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={saveCustomization}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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
    marginBottom: 20,
  },
  closeButton: { width: 48, height: 48, justifyContent: 'center' },
  progressContainer: { flex: 1, paddingHorizontal: 12 },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#50B8B8', borderRadius: 4 },
  stepText: { fontSize: 17, fontFamily: 'Outfit-SemiBold', color: '#FFF', minWidth: 60, textAlign: 'right' },
  stepTextLight: { fontFamily: 'Outfit-Regular', color: 'rgba(255,255,255,0.7)' },

  // Intro State
  introContainer: { flex: 1 },
  textSection: { flex: 1, paddingTop: 40 },
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(80,184,184,0.2)',
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
    color: '#386068',
  },

  // Center Container (Countdown & Breathing)
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Breathing Pattern Indicator
  patternIndicator: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
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
  patternIcon: { fontSize: 18 },
  patternNumber: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFF',
  },

  // Breathing Circle
  breathingCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: CIRCLE_MAX_SIZE + 40,
    height: CIRCLE_MAX_SIZE + 40,
  },
  breathingCircle: {
    width: CIRCLE_MIN_SIZE,
    height: CIRCLE_MIN_SIZE,
    borderRadius: CIRCLE_MIN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,40,40,0.8)',
    borderWidth: 2,
    borderColor: 'rgba(80,184,184,0.3)',
  },
  circleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGlow: {
    position: 'absolute',
    width: CIRCLE_MIN_SIZE + 30,
    height: CIRCLE_MIN_SIZE + 30,
    borderRadius: (CIRCLE_MIN_SIZE + 30) / 2,
    backgroundColor: 'rgba(80,184,184,0.15)',
    zIndex: -1,
  },
  circleGlowOuter: {
    position: 'absolute',
    width: CIRCLE_MAX_SIZE + 60,
    height: CIRCLE_MAX_SIZE + 60,
    borderRadius: (CIRCLE_MAX_SIZE + 60) / 2,
    borderWidth: 2,
    borderColor: 'rgba(80,184,184,0.2)',
    backgroundColor: 'transparent',
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
    fontSize: 24,
    fontFamily: 'Outfit-Regular',
    color: '#FFFFFF',
  },
  poeticMessage: {
    fontSize: 20,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    marginTop: 50,
    textAlign: 'center',
    paddingHorizontal: 20,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: 'rgba(30,50,50,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
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
    color: '#FFFFFF',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  toggleOptionActive: {
    backgroundColor: 'rgba(80,184,184,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(80,184,184,0.4)',
  },
  toggleText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255,255,255,0.5)',
  },
  toggleTextActive: {
    color: '#50B8B8',
  },
  sliderContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  sliderValue: {
    fontSize: 48,
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  sliderTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  sliderTick: {
    width: 8,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
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
    color: '#1A3030',
  },
});
