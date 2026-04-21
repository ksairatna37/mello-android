/**
 * Analysing Screen
 *
 * Step-based vertical word carousel with sticky dots:
 * - One word is always locked next to the dots.
 * - Each step: list translates up by exactly one row, while 1st & 3rd dots rotate 180°
 *   around the fixed center dot.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MelloGradient from '@/components/common/MelloGradient';
import { saveCurrentStep } from '@/utils/onboardingStorage';
import { getEmotionalProfile } from '@/utils/emotionalProfileCache';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Carousel constants ───────────────────────────────────────────────────────

const WORDS = [
  'Mood Map',
  'Coping Style',
  'Night Patterns',
  'Inner Voice',
  'Energy Level',
  'Stress Signals',
  'Growth Patterns',
  'Support Needs',
  'Resilience',
  'Emotional Core',
];

// Double-buffer: 20 items instead of 30 — fewer animated views = less per-frame work
const N = WORDS.length;
const BUFFER = [...WORDS, ...WORDS];
const INITIAL_INDEX = 0;

// Visual height for each word row.
const ITEM_H = 46;

const VISIBLE_WORDS = 5;
const CHART_SIZE = ITEM_H * VISIBLE_WORDS;

// Time per step (one word → next word).
const MS_PER_WORD = 900;

// Vertical center line of the carousel.
const CAROUSEL_CENTER = CHART_SIZE / 2;

// Helper: for a given active index, what should the list's translateY be
// so that word[activeIndex] is vertically centered on CAROUSEL_CENTER?
const translateForIndex = (index: number) => {
  'worklet';
  // word i is at y = i * ITEM_H + ITEM_H / 2 + translateY
  // we want that to equal CAROUSEL_CENTER
  // => translateY = CAROUSEL_CENTER - (i * ITEM_H + ITEM_H / 2)
  return CAROUSEL_CENTER - (index * ITEM_H + ITEM_H / 2);
};

// ─── Word Row ─────────────────────────────────────────────────────────────────

function WordRow({
  word,
  index,
  translateY,
}: {
  word: string;
  index: number;
  translateY: SharedValue<number>;
}) {
  const rowStyle = useAnimatedStyle(() => {
    // Center of this row in carousel space
    const cy = index * ITEM_H + ITEM_H / 2 + translateY.value;
    const dist = Math.abs(cy - CAROUSEL_CENTER);

    // Fade to 0 within ~2 rows so words vanish before the container edge
    const baseOpacity = interpolate(
      dist,
      [0, ITEM_H * 0.5, ITEM_H * 1.2, ITEM_H * 2.0],
      [1, 0.55, 0.15, 0],
      Extrapolation.CLAMP,
    );

    // Slight size boost near center for a "leading word" feel
    const scale = interpolate(
      dist,
      [0, ITEM_H],
      [1.04, 1],
      Extrapolation.CLAMP,
    );

    // Smooth opacity — no hard snap, just distance-based fade
    const opacity = baseOpacity;

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View style={[styles.wordRow, rowStyle]}>
      <Text style={styles.wordText}>{word}</Text>
    </Animated.View>
  );
}

// ─── Word Carousel ────────────────────────────────────────────────────────────

function WordCarousel() {
  const activeIndex = useSharedValue(INITIAL_INDEX);
  const translateY = useSharedValue(translateForIndex(INITIAL_INDEX));

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const queueNextStep = () => {
      if (!isMounted) return;
      timer = setTimeout(() => {
        if (!isMounted) return;
        step();
      }, 450); // small hold after each word; tweak or set to 0
    };

    const step = () => {
      'worklet';
      if (!isMounted) return;
      const current = activeIndex.value;
      const nextIndex = current + 1;
      const duration = MS_PER_WORD;

      translateY.value = withTiming(
        translateForIndex(nextIndex),
        { duration, easing: Easing.inOut(Easing.ease) },
        (finished) => {
          'worklet';
          if (!finished) return;
          // Silent reset: when entering the second copy, jump back to first copy
          // (same word at same screen position — visually seamless)
          if (nextIndex >= N) {
            activeIndex.value = nextIndex - N;
            translateY.value = translateForIndex(nextIndex - N);
          } else {
            activeIndex.value = nextIndex;
          }
          runOnJS(queueNextStep)();
        },
      );
    };

    queueNextStep();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [activeIndex, translateY]);

  const listStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.carouselContainer}>
      <Animated.View style={listStyle}>
        {BUFFER.map((word, i) => (
          <WordRow
            key={`${word}-${i}`}
            word={word}
            index={i}
            translateY={translateY}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AnalysingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<'animating' | 'waiting' | 'ready'>('animating');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buttonOpacity = useSharedValue(0);
  const buttonY = useSharedValue(24);
  const buttonScale = useSharedValue(1);
  const waitingOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(16);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    saveCurrentStep('analysing');

    const eio = Easing.inOut(Easing.ease);
    titleOpacity.value = withTiming(1, { duration: 600, easing: eio });
    titleY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
    subtitleOpacity.value = withTiming(1, { duration: 500, easing: eio });

    const tStart = setTimeout(handleAnalysisDone, 1200);
    return () => {
      clearTimeout(tStart);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnalysisDone = () => {
    getEmotionalProfile().then((cached) => {
      if (cached) {
        setTimeout(revealButton, 2500);
      } else {
        setPhase('waiting');
        waitingOpacity.value = withTiming(1, { duration: 400 });
        pollRef.current = setInterval(async () => {
          const result = await getEmotionalProfile();
          if (result) {
            if (pollRef.current) clearInterval(pollRef.current);
            waitingOpacity.value = withTiming(0, { duration: 300 });
            setTimeout(revealButton, 2500);
          }
        }, 600);
      }
    });
  };

  const revealButton = () => {
    setPhase('ready');
    buttonOpacity.value = withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) });
    buttonY.value = withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) });
  };

  const navigate = () => {
    router.replace('/(onboarding-new)/emotional-mindwave' as any);
  };

  const waitingStyle = useAnimatedStyle(() => ({ opacity: waitingOpacity.value }));
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonY.value }, { scale: buttonScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

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
          <Text style={styles.logo}>SelfMind</Text>
        </View>

        <View style={styles.centerSection}>
          <WordCarousel />

          <Animated.View style={[styles.titleBlock, titleStyle]}>
            <Text style={styles.title}>Analysing your{'\n'}answers</Text>
          </Animated.View>

          <Animated.View style={subtitleStyle}>
            <Text style={styles.subtitle}>Building your SelfMind profile</Text>
          </Animated.View>

          {phase === 'waiting' && (
            <Animated.View style={[styles.waitingRow, waitingStyle]}>
              <ActivityIndicator size="small" color="#8B7EF8" />
              <Text style={styles.waitingText}>Finalising your profile…</Text>
            </Animated.View>
          )}
        </View>

        <Animated.View style={buttonStyle} pointerEvents={phase === 'ready' ? 'auto' : 'none'}>
          <Pressable
            style={styles.resultButton}
            onPress={navigate}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <Text style={styles.resultButtonText}>Result</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0FF' },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  logoRow: { alignItems: 'center' },
  logo: { fontSize: 32, fontFamily: 'DMSerif', color: '#1A1A1A' },

  centerSection: {
    alignItems: 'center',
    gap: 16,
  },

  // ── Carousel ──
  carouselContainer: {
    width: SCREEN_WIDTH - 48,
    height: CHART_SIZE,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  wordRow: {
    height: ITEM_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordText: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    includeFontPadding: false,
    textAlign: 'center',
  },

  // ── Title ──
  titleBlock: { alignItems: 'center' },
  title: {
    fontSize: 30,
    fontFamily: 'Outfit-Regular',
    color: '#1A1A1A',
    lineHeight: 44,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#666666',
    textAlign: 'center',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waitingText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#9999A8',
  },

  // ── Button ──
  resultButton: {
    backgroundColor: '#8B7EF8',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    width: SCREEN_WIDTH - 48,
  },
  resultButtonText: {
    fontSize: 17,
    fontFamily: 'Outfit-SemiBold',
    color: '#fff',
    letterSpacing: 0.3,
  },
});