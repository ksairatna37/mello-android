/**
 * Personalize Intro Screen
 * Shown once after auth, before the 10-question onboarding flow
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  cancelAnimation,
  Easing,
  useDerivedValue,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import MelloGradient from '@/components/common/MelloGradient';

// ─── Chart Constants ──────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_SIZE = Math.min(SCREEN_WIDTH - 40, 360);
const CENTER = CHART_SIZE / 2;
const RADIUS = CHART_SIZE / 2 - 38;

const TWO_PI_OVER_5 = (2 * Math.PI) / 5;
const AXIS_ANGLES = [
  -Math.PI / 2,
  -Math.PI / 2 + TWO_PI_OVER_5,
  -Math.PI / 2 + 2 * TWO_PI_OVER_5,
  -Math.PI / 2 + 3 * TWO_PI_OVER_5,
  -Math.PI / 2 + 4 * TWO_PI_OVER_5,
];
const GRID_LEVELS = [0.33, 0.66, 1];
const DASH_PERIOD = 9; // dash(4) + gap(5)

const LABELS = ['Positivity', 'Productivity', 'Confidence', 'Calmness', 'Conflict'] as const;
const CARD_HALF_W = 52; // half of card width — centers card on dot position
const MIN_DOT_GAP = 80; // minimum px between any two dot centers

// Shared registry — each slot holds the last-assigned position for dot[i]
const dotRegistry: Array<{ cx: number; cy: number } | null> = Array(5).fill(null);

// ─── Random position within the radar circle, enforcing gap from other dots ──

function randomPosWithGap(myIndex: number): { cx: number; cy: number } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = Math.random() * 2 * Math.PI;
    const r = (0.22 + Math.random() * 0.62) * RADIUS;
    const cx = CENTER + Math.cos(angle) * r;
    const cy = CENTER + Math.sin(angle) * r;

    const tooClose = dotRegistry.some((pos, i) => {
      if (i === myIndex || pos === null) return false;
      const dx = cx - pos.cx;
      const dy = cy - pos.cy;
      return Math.sqrt(dx * dx + dy * dy) < MIN_DOT_GAP;
    });

    if (!tooClose) {
      dotRegistry[myIndex] = { cx, cy };
      return { cx, cy };
    }
  }

  // Fallback after max attempts — just place it anywhere
  const angle = Math.random() * 2 * Math.PI;
  const r = (0.22 + Math.random() * 0.62) * RADIUS;
  const pos = { cx: CENTER + Math.cos(angle) * r, cy: CENTER + Math.sin(angle) * r };
  dotRegistry[myIndex] = pos;
  return pos;
}

// ─── Floating Dot ─────────────────────────────────────────────────────────────

function FloatingDot({ label, dotIndex, staggerDelay }: { label: string; dotIndex: number; staggerDelay: number }) {
  const opacity = useSharedValue(0);
  const [pos, setPos] = useState<{ cx: number; cy: number }>(() => randomPosWithGap(dotIndex));
  const mounted = useRef(true);

  useEffect(() => {
    const eio = Easing.inOut(Easing.cubic);

    // Step 3: invisible — update position then wait one frame before fading in again
    const onInvisible = () => {
      if (!mounted.current) return;
      setPos(randomPosWithGap(dotIndex));
      requestAnimationFrame(() => {
        if (!mounted.current) return;
        doFadeIn(400);
      });
    };

    // Step 2: fade out smoothly, then call onInvisible on JS thread
    const doFadeOut = () => {
      opacity.value = withDelay(
        4500,
        withTiming(0, { duration: 2200, easing: eio }, (finished) => {
          'worklet';
          if (finished) runOnJS(onInvisible)();
        })
      );
    };

    // Step 1: fade in smoothly, then kick off fade-out on JS thread
    const doFadeIn = (delay: number) => {
      opacity.value = withDelay(
        delay,
        withTiming(1, { duration: 2000, easing: eio }, (finished) => {
          'worklet';
          if (finished) runOnJS(doFadeOut)();
        })
      );
    };

    doFadeIn(staggerDelay);

    return () => {
      mounted.current = false;
      cancelAnimation(opacity);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Card is centered on pos.cx; offset top so the dot center sits at pos.cy
  // Card layout: tag (≈24px tall) + gap (8px) + halo (22px) → dot center at 24+8+11=43px from top
  return (
    <Animated.View
      style={[
        styles.floatingCard,
        { left: pos.cx - CARD_HALF_W, top: pos.cy - 43 },
        animStyle,
      ]}
    >
      {/* Label at the top */}
      <View style={styles.dotTag}>
        <Text style={styles.dotTagText}>{label}</Text>
      </View>

      {/* Dot + halo below label */}
      <View style={styles.dotWrapper}>
        <View style={styles.dotHalo}>
          <View style={styles.dotInner} />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── SVG background — rings + axes only ──────────────────────────────────────

type SvgState = { ringDashCW: number; ringDashCCW: number; axisDash: number };

function RadarBackground({ dashProgress }: { dashProgress: SharedValue<number> }) {
  const [svg, setSvg] = useState<SvgState>({ ringDashCW: 0, ringDashCCW: 0, axisDash: 0 });

  useDerivedValue(() => {
    'worklet';
    const d = dashProgress.value;
    runOnJS(setSvg)({
      ringDashCW: d,
      ringDashCCW: DASH_PERIOD - d,
      axisDash: -d,
    });
  });

  return (
    <Svg width={CHART_SIZE} height={CHART_SIZE} style={StyleSheet.absoluteFill}>
      {/* Grid rings — outer CW, inner two CCW */}
      {GRID_LEVELS.map((lvl, i) => (
        <Circle
          key={`ring-${i}`}
          cx={CENTER}
          cy={CENTER}
          r={RADIUS * lvl}
          fill="none"
          stroke="rgba(139,126,248,0.22)"
          strokeWidth={1}
          strokeDasharray="4,5"
          strokeDashoffset={i === 2 ? svg.ringDashCW : svg.ringDashCCW}
        />
      ))}

      {/* Axis lines — static */}
      {AXIS_ANGLES.map((angle, i) => (
        <Line
          key={`axis-${i}`}
          x1={CENTER}
          y1={CENTER}
          x2={CENTER + Math.cos(angle) * RADIUS}
          y2={CENTER + Math.sin(angle) * RADIUS}
          stroke="rgba(139,126,248,0.28)"
          strokeWidth={1}
          strokeDasharray="4,5"
        />
      ))}
    </Svg>
  );
}

// ─── Composed chart ───────────────────────────────────────────────────────────

function AnimatedRadarChart({ dashProgress }: { dashProgress: SharedValue<number> }) {
  return (
    <View style={{ width: CHART_SIZE, height: CHART_SIZE }}>
      <RadarBackground dashProgress={dashProgress} />

      {/* Floating dots with label tags — absolutely positioned over SVG */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {LABELS.map((label, i) => (
          <FloatingDot
            key={label}
            label={label}
            dotIndex={i}
            staggerDelay={i * 1800}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PersonalizeIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const dashProgress = useSharedValue(0);
  const chartOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(16);
  const privacyOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    const eio = Easing.inOut(Easing.ease);

    chartOpacity.value = withTiming(1, { duration: 700, easing: eio });

    dashProgress.value = withRepeat(
      withTiming(DASH_PERIOD, { duration: 600, easing: Easing.linear }),
      -1,
      false
    );

    titleOpacity.value = withDelay(300, withTiming(1, { duration: 600, easing: eio }));
    titleY.value = withDelay(300, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
    privacyOpacity.value = withDelay(700, withTiming(1, { duration: 500, easing: eio }));
    buttonOpacity.value = withDelay(900, withTiming(1, { duration: 500, easing: eio }));
  }, []);

  const chartStyle = useAnimatedStyle(() => ({ opacity: chartOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const privacyStyle = useAnimatedStyle(() => ({ opacity: privacyOpacity.value }));
  const buttonStyle = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <MelloGradient />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.logoRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.logo}>SelfMind</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.centerSection}>
          <Animated.View style={chartStyle}>
            <AnimatedRadarChart dashProgress={dashProgress} />
          </Animated.View>

          <Animated.View style={titleStyle}>
            <Text style={styles.title}>Help us build a personalized emotional profile for you</Text>
            {/* <Text style={styles.title}>Let's personalize{'\n'}<Text style={styles.title}>SelfMind</Text> for you.</Text> */}
          </Animated.View>

          <Animated.View style={[styles.privacyRow, privacyStyle]}>
            {/* <Text style={styles.privacyText}>
              Your individual data will not be shared outside SelfMind.
            </Text> */}
            <Text style={styles.privacyText}>
              We want to hear your story so that we
can build the right solution
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={buttonStyle}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.replace('/(onboarding-new)/name-input' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0FF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  logo: {
    fontSize: 32,
    fontFamily: 'DMSerif',
    color: '#1A1A1A',
  },
  centerSection: {
    alignItems: 'center',
    gap: 20,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Outfit-Regular',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 44,
  },
  highlight: {
    fontFamily: 'DMSerif',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
  },
  privacyText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#666666',
    flex: 1,
    textAlign: 'center',
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#8B7EF8',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  continueButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },

  // Floating card — label on top, dot centered below
  floatingCard: {
    position: 'absolute',
    alignItems: 'center',
    gap: 8,
  },
  dotTag: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(139,126,248,0.28)',
  },
  dotTagText: {
    fontSize: 11,
    fontFamily: 'Outfit-SemiBold',
    color: '#8B7EF8',
  },
  dotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotHalo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(139,126,248,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#A78BFA',
  },
});
