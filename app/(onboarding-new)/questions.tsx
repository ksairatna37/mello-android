/**
 * Onboarding Questions Screen
 *
 * Format: Vertical auto-scroll pager.
 * Each question page (header + content) fills the full screen.
 * Tap an option → the WHOLE page scrolls up to the next question.
 *
 * No nav buttons. No manual scrolling. No bounce.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
  StatusBar,
  Modal,
  Keyboard,
  TextInput,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedRef,
  useDerivedValue,
  scrollTo,
  withTiming,
  withSpring,
  withSequence,
  withDelay, // ✅ ADD THIS
  cancelAnimation,
  runOnJS,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Battery from 'expo-battery';
import MelloGradient from '@/components/common/MelloGradient';
import { updateOnboardingData, saveCurrentStep } from '@/utils/onboardingStorage';
import type { OnboardingData } from '@/utils/onboardingStorage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────────────────────────────────

interface Option {
  id: string;
  icon: string;
  label: string;
  description: string;
  isCustomInput?: boolean;
}

interface Question {
  id: string;
  title: string;
  subtitle: string;
  storageKey?: keyof OnboardingData;
  options: Option[];
  type?: 'options' | 'battery' | 'fact';
}

// ─── Questions ────────────────────────────────────────────────────────────────

const QUESTIONS: Question[] = [
  {
    id: 'mood_weather',
    storageKey: 'moodWeather',
    title: "What's the weather inside your head right now?",
    subtitle: "Tap the one that feels right.",
    options: [
      { id: 'stormy', icon: 'thunderstorm-outline', label: 'Stormy', description: 'Everything feels like too much' },
      { id: 'rainy', icon: 'rainy-outline', label: 'Rainy', description: 'Heavy and slow today' },
      { id: 'foggy', icon: 'cloud-outline', label: 'Foggy', description: "Can't think straight" },
      { id: 'cloudy', icon: 'partly-sunny-outline', label: 'Cloudy', description: 'Up and down, hard to tell' },
      { id: 'okay', icon: 'sunny-outline', label: 'Surprisingly Okay', description: "Don't know why I'm here tbh" },
    ],
  },
  {
    id: 'spirit_animal',
    storageKey: 'spiritAnimal',
    title: "When you're struggling, you're most like...",
    subtitle: "Pick your spirit animal.",
    options: [
      { id: 'turtle', icon: 'ellipse-outline', label: 'The Turtle', description: 'I go quiet and process alone' },
      { id: 'butterfly', icon: 'flower-outline', label: 'The Butterfly', description: 'I need to talk it out' },
      { id: 'wolf', icon: 'people-outline', label: 'The Wolf', description: 'I need my people around me' },
      { id: 'lion', icon: 'flash-outline', label: 'The Lion', description: 'Just tell me what to do' },
      { id: 'shell', icon: 'shield-outline', label: 'The Shell', description: 'I shut down first, then slowly open up' },
    ],
  },
  {
    id: 'late_night_mood',
    storageKey: 'lateNightMood',
    title: "It's 2am. You can't sleep. What's actually going on?",
    subtitle: "Tap the one that fits.",
    options: [
      { id: 'loop', icon: 'refresh-outline', label: 'The Loop', description: "Same thoughts. Over and over. Won't stop." },
      { id: 'ache', icon: 'pulse-outline', label: 'The Ache', description: "Something hurts but I can't explain what." },
      { id: 'replay', icon: 'play-back-outline', label: 'The Replay', description: "Going over a conversation I can't undo." },
      { id: 'overwhelm', icon: 'layers-outline', label: 'The Overwhelm', description: "Everything at once. Don't know where to start." },
      { id: 'void', icon: 'remove-circle-outline', label: 'The Void', description: 'Nothing. Just... empty. And that feels worse.' },
      { id: 'wander', icon: 'map-outline', label: 'The Wander', description: "I'm fine, I just stumbled here." },
    ],
  },
  {
    id: 'text_to_self',
    storageKey: 'textToSelf',
    title: "If you could text yourself from 6 months ago...",
    subtitle: "Tap to finish the sentence 💬",
    options: [
      { id: 'okay', icon: 'heart-outline', label: '"Hey. You\'re going to be okay. Just—"', description: '' },
      { id: 'alone', icon: 'people-outline', label: '"Stop carrying everything alone."', description: '' },
      { id: 'figured', icon: 'help-circle-outline', label: '"It\'s okay that you don\'t have it figured out."', description: '' },
      { id: 'grown', icon: 'leaf-outline', label: '"You\'ve grown more than you know."', description: '' },
      { id: 'avoiding', icon: 'alarm-outline', label: '"The thing you\'re avoiding? It\'s time."', description: '' },
      { id: 'custom_input', icon: 'pencil-outline', label: 'or write on your own...', description: '', isCustomInput: true },
    ],
  },
  {
    id: 'emotional_battery',
    storageKey: 'emotionalBattery',
    title: 'How full is your emotional battery right now?',
    subtitle: "Take a moment to tune in.",
    type: 'battery',
    options: [],
  },
  {
    id: 'did_you_know',
    title: '',
    subtitle: '',
    type: 'fact',
    options: [],
  },
];

const TOTAL_QUESTIONS = 10;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuestionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const aScrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  const [writeSheetVisible, setWriteSheetVisible] = useState(false);
  const [writeSheetQIndex, setWriteSheetQIndex] = useState(0);
  const [deviceBatteryPct, setDeviceBatteryPct] = useState(50);
  const scrollLock = useRef(false);

  useEffect(() => {
    Battery.getBatteryLevelAsync()
      .then((level) => { if (level >= 0) setDeviceBatteryPct(Math.round(level * 100)); })
      .catch(() => { });
  }, []);

  useDerivedValue(() => {
    scrollTo(aScrollRef, 0, scrollY.value, false);
  });

  useEffect(() => {
    saveCurrentStep('questions');
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    if (scrollLock.current) return;
    scrollLock.current = true;
    setCurrentIndex(index);
    scrollY.value = withTiming(index * SCREEN_HEIGHT, {
      duration: 650,
      easing: Easing.inOut(Easing.cubic),
    });
    setTimeout(() => { scrollLock.current = false; }, 700);
  }, []);

  const handleBack = useCallback((fromIndex: number) => {
    if (fromIndex > 0) {
      scrollToIndex(fromIndex - 1);
    } else {
      router.replace('/(onboarding-new)/personalize-intro' as any);
    }
  }, [scrollToIndex, router]);

  const handleSelect = useCallback(
    async (question: Question, optionId: string, qIndex: number) => {
      if (scrollLock.current) return;
      scrollLock.current = true;
      setAnswers((prev) => ({ ...prev, [question.id]: optionId }));
      if (question.storageKey) {
        updateOnboardingData({ [question.storageKey]: optionId } as Partial<OnboardingData>);
      }

      const nextIndex = qIndex + 1;
      setTimeout(async () => {
        if (nextIndex < QUESTIONS.length) {
          scrollLock.current = false;
          scrollToIndex(nextIndex);
        } else {
          scrollLock.current = false;
          await saveCurrentStep('name-input');
          router.replace('/(onboarding-new)/name-input' as any);
        }
      }, 680);
    },
    [router, scrollToIndex]
  );

  const handleOpenWriteSheet = useCallback((qIndex: number) => {
    if (scrollLock.current) return;
    setWriteSheetQIndex(qIndex);
    setWriteSheetVisible(true);
  }, []);

  const handleWriteSheetSubmit = useCallback((text: string) => {
    const question = QUESTIONS[writeSheetQIndex];
    setWriteSheetVisible(false);
    setTimeout(() => {
      setCustomTexts((prev) => ({ ...prev, [question.id]: text }));
      updateOnboardingData({ textToSelfCustom: text });
      handleSelect(question, 'custom_input', writeSheetQIndex);
    }, 320);
  }, [writeSheetQIndex, handleSelect]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <MelloGradient />

      <Animated.ScrollView
        ref={aScrollRef}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        style={StyleSheet.absoluteFill}
      >
        {QUESTIONS.map((question, qIndex) => (
          <QuestionPage
            key={question.id}
            question={question}
            qIndex={qIndex}
            currentIndex={currentIndex}
            answer={answers[question.id]}
            customTexts={customTexts}
            topInset={insets.top}
            bottomInset={insets.bottom}
            deviceBatteryPct={deviceBatteryPct}
            onSelect={handleSelect}
            onBack={handleBack}
            onOpenWriteSheet={handleOpenWriteSheet}
          />
        ))}
      </Animated.ScrollView>

      <WriteYourOwnSheet
        visible={writeSheetVisible}
        prompt={QUESTIONS[writeSheetQIndex]?.title ?? ''}
        initialValue={customTexts[QUESTIONS[writeSheetQIndex]?.id ?? ''] ?? ''}
        onClose={() => setWriteSheetVisible(false)}
        onSubmit={handleWriteSheetSubmit}
      />
    </View>
  );
}

// ─── Option Card ─────────────────────────────────────────────────────────────

function OptionCard({
  option,
  selected,
  dimmed,
  customText,
  onPress,
}: {
  option: Option;
  selected: boolean;
  dimmed: boolean;
  customText?: string;
  onPress: () => void;
}) {
  const anim = useSharedValue(selected ? 1 : 0);
  const dimAnim = useSharedValue(dimmed ? 0.5 : 1);

  useEffect(() => {
    anim.value = withTiming(selected ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.ease),
    });
  }, [selected]);

  useEffect(() => {
    dimAnim.value = withTiming(dimmed ? 0.5 : 1, {
      duration: 280,
      easing: Easing.inOut(Easing.ease),
    });
  }, [dimmed]);

  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: dimAnim.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255,255,255,${0.55 + anim.value * 0.35})`,
    borderColor: `rgba(139,126,248,${0.12 + anim.value * 0.63})`,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(anim.value, [0, 1], ['#1A1A1A', '#8B7EF8']),
  }));

  const descStyle = useAnimatedStyle(() => ({
    color: interpolateColor(anim.value, [0, 1], ['#9999A8', '#8B7EF8']),
  }));

  return (
    <Animated.View style={wrapperStyle}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        <Animated.View style={[styles.optionCard, cardStyle]}>
          <View style={styles.iconBadge}>
            <Ionicons
              name={option.icon as any}
              size={20}
              color={selected ? '#8B7EF8' : '#9999A8'}
            />
          </View>

          <View style={styles.optionTextBlock}>
            <Animated.Text
              style={[
                styles.optionLabel,
                (option.description === '' || !!(customText && selected)) && styles.optionLabelStandalone,
                option.isCustomInput && !customText && styles.optionLabelCustomPrompt,
                labelStyle,
              ]}
            >
              {option.isCustomInput && customText && selected ? customText : option.label}
            </Animated.Text>
            {option.description !== '' && !customText && (
              <Animated.Text style={[styles.optionDescription, descStyle]}>
                {option.description}
              </Animated.Text>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Question Page ────────────────────────────────────────────────────────────

interface QuestionPageProps {
  question: Question;
  qIndex: number;
  currentIndex: number;
  answer: string | undefined;
  customTexts: Record<string, string>;
  topInset: number;
  bottomInset: number;
  deviceBatteryPct: number;
  onSelect: (question: Question, optionId: string, qIndex: number) => void;
  onBack: (fromIndex: number) => void;
  onOpenWriteSheet: (qIndex: number) => void;
}

function QuestionPage({
  question,
  qIndex,
  currentIndex,
  answer,
  customTexts,
  topInset,
  bottomInset,
  deviceBatteryPct,
  onSelect,
  onBack,
  onOpenWriteSheet,
}: QuestionPageProps) {
  const isCurrent = currentIndex === qIndex;
  const progressWidth = ((qIndex + 1) / TOTAL_QUESTIONS) * 100;

  return (
    <View style={[styles.page, { height: SCREEN_HEIGHT }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.progressWrapper}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressWidth}%` }]} />
          </View>
        </View>

        <View style={styles.counterRow}>
          <Pressable style={styles.headerBtn} hitSlop={8} onPress={() => onBack(qIndex)}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </Pressable>
          <Text style={styles.counterText}>Question {qIndex + 1} of {TOTAL_QUESTIONS}</Text>
          <View style={styles.headerBtn} />
        </View>
      </View>

      <View style={[styles.content, { paddingBottom: bottomInset + 20 }]}>
        {question.type !== 'fact' && <Text style={styles.questionTitle}>{question.title}</Text>}
        {question.type !== 'fact' && <Text style={styles.questionSubtitle}>{question.subtitle}</Text>}

        {question.type === 'battery' ? (
          <BatterySlider
            key={`battery-${isCurrent ? 'active' : 'inactive'}`}
            initialPct={answer ? Number(answer) : deviceBatteryPct}
            onConfirm={(pct) => onSelect(question, String(pct), qIndex)}
          />
        ) : question.type === 'fact' ? (
          <DidYouKnow onContinue={() => onSelect(question, 'seen', qIndex)} />
        ) : (
          <View style={styles.optionsContainer}>
            {question.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={answer === option.id}
                dimmed={answer !== undefined && answer !== option.id}
                customText={option.isCustomInput ? customTexts[question.id] : undefined}
                onPress={
                  option.isCustomInput
                    ? () => onOpenWriteSheet(qIndex)
                    : () => onSelect(question, option.id, qIndex)
                }
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Battery Slider ───────────────────────────────────────────────────────────

const BATTERY_BODY_H = 360;
const BATTERY_BODY_W = 200;
const BATTERY_BORDER_W = 8;
const BATTERY_BODY_RADIUS = 50;
const BATTERY_GAP = 8;
const BATTERY_INNER_RADIUS = 35;
const BATTERY_FILL_MAX_H = BATTERY_BODY_H - BATTERY_BORDER_W * 2 - BATTERY_GAP * 2;

const BATTERY_COLORS = {
  inputRange: [0, 0.25, 0.5, 0.75, 1],
  outputRange: ['#E0D4F7', '#D4C4F8', '#C5B0F8', '#B69DF8', '#9D84F8'],
};

// Border color: white at rest → level color on confirm
const BORDER_COLORS = {
  inputRange: [0, 1],
  outputRange: ['rgba(255,255,255,0.85)', '#9D84F8'],
};

function BatterySlider({
  initialPct,
  onConfirm,
}: {
  initialPct: number;
  onConfirm: (pct: number) => void;
}) {
  const safeInitial = (
    typeof initialPct === 'number' &&
    !isNaN(initialPct) &&
    initialPct >= 0 &&
    initialPct <= 100
  ) ? initialPct : 50;

  // ── Shared values ──
  const level = useSharedValue(safeInitial / 100);
  const startLevel = useSharedValue(safeInitial / 100);
  // 0 = white border, 1 = level color border
  const borderAnim = useSharedValue(0);
  // 0 = white terminal, 1 = level color terminal
  const terminalAnim = useSharedValue(0);

  const [displayPct, setDisplayPct] = useState(Math.round(safeInitial));
  const [terminalColor, setTerminalColor] = useState('rgba(255,255,255,0.9)');

  const isConfirming = useRef(false);

  // ── Hint animations ──
  const hintOpacity = useSharedValue(0);
  const hintSlideY = useSharedValue(20);
  const hintBounce = useSharedValue(0);
  const hasInteracted = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Slide-in hint on mount
  useEffect(() => {
    hintOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
    hintSlideY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, []);

  // Cleanup on unmount — cancel any in-flight animations
  useEffect(() => {
    return () => {
      cancelAnimation(level);
      cancelAnimation(borderAnim);
      cancelAnimation(terminalAnim);
      cancelAnimation(hintBounce);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (bounceInterval.current) clearInterval(bounceInterval.current);
    };
  }, []);

  const triggerBounce = useCallback(() => {
    hintBounce.value = withSequence(
      withTiming(-10, { duration: 140, easing: Easing.out(Easing.ease) }),
      withTiming(2, { duration: 110, easing: Easing.in(Easing.ease) }),
      withTiming(-6, { duration: 100, easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: 100, easing: Easing.in(Easing.ease) }),
    );
  }, []);

  useEffect(() => {
    idleTimer.current = setTimeout(() => {
      if (hasInteracted.current) return;
      triggerBounce();
      bounceInterval.current = setInterval(() => {
        if (hasInteracted.current) { clearInterval(bounceInterval.current!); return; }
        triggerBounce();
      }, 4000);
    }, 5000);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (bounceInterval.current) clearInterval(bounceInterval.current);
    };
  }, []);

  const stopIdleAnimations = useCallback(() => {
    hasInteracted.current = true;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (bounceInterval.current) clearInterval(bounceInterval.current);
  }, []);

  const syncDisplay = useCallback((v: number) => {
    const safe = typeof v === 'number' && !isNaN(v)
      ? Math.round(Math.max(0, Math.min(1, v)) * 100)
      : 50;
    setDisplayPct(safe);
  }, []);

  const doConfirm = useCallback((pct: number) => {
    onConfirm(pct);
  }, [onConfirm]);

  const applyTerminalColor = useCallback((color: string) => {
    setTerminalColor(color);
  }, []);

  // ── Pan gesture ──
  const pan = Gesture.Pan()
    .minDistance(1)
    .onStart(() => {
      if (isConfirming.current) return;
      startLevel.value = level.value;
      runOnJS(stopIdleAnimations)();
    })
    .onUpdate((e) => {
      if (isConfirming.current) return;
      const translation = e.translationY;
      if (typeof translation !== 'number' || isNaN(translation)) return;
      const delta = (-translation / BATTERY_BODY_H) * 1.2;
      const next = Math.max(0, Math.min(1, startLevel.value + delta));
      if (!isNaN(next)) {
        level.value = next;
        runOnJS(syncDisplay)(next);
      }
    })
    .onEnd(() => {
      if (isConfirming.current) return;
      isConfirming.current = true;

      const finalLevel = level.value;
      const finalPct = Math.round(finalLevel * 100);

      // Pass level color to terminal overlay
      const levelColor = interpolateColor(
        finalLevel,
        BATTERY_COLORS.inputRange,
        BATTERY_COLORS.outputRange,
      );
      runOnJS(applyTerminalColor)(levelColor);

      borderAnim.value = withSequence(
        // 1. bottom start (quick)
        withTiming(0.3, { duration: 180, easing: Easing.out(Easing.ease) }),

        // 2. side travel (main motion)
        withTiming(0.75, { duration: 260, easing: Easing.inOut(Easing.cubic) }),

        // 3. top closure (snap finish)
        withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) }),
      );

      // 🔥 trigger terminal flash when "top reached"
      terminalAnim.value = withDelay(
        450,
        withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(0.6, { duration: 80 }),
          withTiming(1, { duration: 120 }),
        )
      );

      // ✅ confirm AFTER animation completes
      setTimeout(() => {
        runOnJS(doConfirm)(finalPct);
      }, 650);

    });

  // ── Animated styles ──
  const fillHeightStyle = useAnimatedStyle(() => {
    const h = BATTERY_FILL_MAX_H * level.value;
    return { height: isNaN(h) ? 0 : h };
  });

  const fillColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      level.value,
      BATTERY_COLORS.inputRange,
      BATTERY_COLORS.outputRange,
    ),
  }));

  // Border color transitions white → level color on confirm
  const bodyStyle = useAnimatedStyle(() => {
    const levelColor = interpolateColor(
      level.value,
      BATTERY_COLORS.inputRange,
      BATTERY_COLORS.outputRange,
    );
    return {
      borderColor: interpolateColor(
        borderAnim.value,
        [0, 0.3, 0.75, 1],
        [
          'rgba(255,255,255,0.85)',
          '#cfc3ff',
          '#b69df8',
          levelColor,
        ],
      ),
    };
  });

  const terminalAnimStyle = useAnimatedStyle(() => ({
    opacity: terminalAnim.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
    transform: [{ translateY: hintSlideY.value + hintBounce.value }],
  }));

  return (
    <View style={styles.batteryOuter}>
      <View style={styles.batterySection}>
        <GestureDetector gesture={pan}>
          <Animated.View style={styles.batteryGestureArea}>

            {/* Terminal nub */}
            <View style={styles.batteryTerminal}>
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: terminalColor },
                  terminalAnimStyle,
                ]}
              />
            </View>

            {/* Battery body — border color animated directly */}
            <Animated.View style={[styles.batteryBody, bodyStyle]}>
              {/* Interior fill */}
              <View style={styles.batteryInterior}>
                <Animated.View style={[styles.batteryFill, fillHeightStyle, fillColorStyle]} />
              </View>

              {/* Percentage label */}
              <View style={styles.batteryPctContainer}>
                <Text style={styles.batteryPct}>{displayPct}%</Text>
              </View>
            </Animated.View>

          </Animated.View>
        </GestureDetector>

        <Animated.Text style={[styles.batteryHint, hintStyle]}>Slide up or down</Animated.Text>
      </View>
    </View>
  );
}

// ─── Did You Know ─────────────────────────────────────────────────────────────

function DidYouKnow({ onContinue }: { onContinue: () => void }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
    translateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.dykOuter}>
      <Animated.View style={[styles.dykCard, containerStyle]}>
        <Text style={styles.dykEmoji}>🧠</Text>
        <Text style={styles.dykLabel}>DID YOU KNOW</Text>
        <Text style={styles.dykFact}>
          Naming what you feel literally changes your brain. Labeling an emotion activates your
          prefrontal cortex and calms your amygdala — the part that drives fear and stress.
        </Text>
        <Text style={styles.dykSub}>That's what you just did. Good.</Text>
      </Animated.View>

      <TouchableOpacity style={styles.dykBtn} onPress={onContinue} activeOpacity={0.8}>
        <Text style={styles.dykBtnText}>Keep going</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Write Your Own Sheet ─────────────────────────────────────────────────────

interface WriteYourOwnSheetProps {
  visible: boolean;
  prompt: string;
  initialValue: string;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

function WriteYourOwnSheet({ visible, prompt, initialValue, onClose, onSubmit }: WriteYourOwnSheetProps) {
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const sheetBottom = useSharedValue(16);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    setValue('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      sheetBottom.value = withTiming(e.endCoordinates.height + 16, { duration: 250 });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      sheetBottom.value = withTiming(16, { duration: 250 });
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setIsVisible(true);
      backdropOpacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 50, stiffness: 150, mass: 0.5 });
      setTimeout(() => inputRef.current?.focus(), 350);
    } else if (isVisible) {
      backdropOpacity.value = withTiming(0, { duration: 250 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, (finished) => {
        if (finished) runOnJS(hideModal)();
      });
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 250 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, (finished) => {
      if (finished) runOnJS(hideModal)();
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    handleClose();
  }, [value, onSubmit, handleClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    bottom: sheetBottom.value,
  }));

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <View style={styles.wsContainer}>
        <Animated.View style={[styles.wsBackdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={[styles.wsSheet, sheetStyle]}>
          <View style={styles.wsHandle} />

          <View style={[styles.wsContent, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.wsHeader}>
              <Text style={styles.wsTitle}>Finish the sentence</Text>
              <Pressable style={styles.wsCloseBtn} onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={20} color="#1A1A1A" />
              </Pressable>
            </View>

            <Text style={styles.wsPrompt} numberOfLines={2}>{prompt}</Text>

            <TextInput
              ref={inputRef}
              style={styles.wsInput}
              value={value}
              onChangeText={setValue}
              placeholder="Type your answer..."
              placeholderTextColor="rgba(0,0,0,0.3)"
              multiline
              maxLength={200}
              blurOnSubmit={true}
              onSubmitEditing={handleSubmit}
              selectionColor="#b9a6ff"
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.wsSubmitBtn, !value.trim() && styles.wsSubmitBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={!value.trim()}
            >
              <Text style={styles.wsSubmitBtnText}>Finish the sentence</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0FF',
  },

  // ── Page ──
  page: {
    width: '100%',
  },

  // ── Header ──
  header: {
    paddingBottom: 8,
  },
  progressWrapper: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#ffffffac',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#b9a6ff',
    borderRadius: 2,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },

  // ── Content ──
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  questionTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    lineHeight: 30,
    marginBottom: 4,
    width: '100%',
  },
  questionSubtitle: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: '#999999',
    marginBottom: 16,
  },

  // ── Options ──
  optionsContainer: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 2,
    gap: 12,
  },
  iconBadge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextBlock: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    marginBottom: 1,
  },
  optionLabelStandalone: {
    marginBottom: 0,
  },
  optionLabelCustomPrompt: {
    fontFamily: 'Outfit-Regular',
    color: '#9999A8',
    fontStyle: 'italic',
  },
  optionDescription: {
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
    color: '#999999',
  },

  // ── Write Your Own Sheet ──
  wsContainer: {
    flex: 1,
  },
  wsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 998,
  },
  wsSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  wsHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  wsContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  wsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  wsTitle: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 18,
    color: '#1A1A1A',
  },
  wsCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wsPrompt: {
    fontFamily: 'Outfit-Regular',
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
    lineHeight: 20,
  },
  wsInput: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    minHeight: 90,
  },
  wsSubmitBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: '#8B7EF8',
  },
  wsSubmitBtnDisabled: {
    backgroundColor: 'rgba(139,126,248,0.35)',
  },
  wsSubmitBtnText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },

  // ── Battery Slider ──
  batteryOuter: {
    flex: 1,
    alignSelf: 'stretch',
  },
  batterySection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  batteryGestureArea: {
    alignItems: 'center',
  },
  batteryTerminal: {
    width: 56,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    marginBottom: 5,
    zIndex: 1,
    overflow: 'hidden', // ✅ KEY FIX
  },
  batteryBody: {
    width: BATTERY_BODY_W,
    height: BATTERY_BODY_H,
    borderRadius: BATTERY_BODY_RADIUS,
    borderWidth: BATTERY_BORDER_W,
    // base color — overridden by animated bodyStyle
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'transparent',
  },
  batteryInterior: {
    position: 'absolute',
    top: BATTERY_GAP,
    left: BATTERY_GAP,
    right: BATTERY_GAP,
    bottom: BATTERY_GAP,
    borderRadius: BATTERY_INNER_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  batteryFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: BATTERY_INNER_RADIUS - 2,
  },
  batteryPctContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  batteryPct: {
    fontSize: 52,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
  },
  batteryHint: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#7A7A8A',
    textAlign: 'center',
    marginTop: 20,
  },

  // ── Did You Know ──
  dykOuter: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  dykCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 12,
  },
  dykEmoji: {
    fontSize: 56,
    marginBottom: 4,
  },
  dykLabel: {
    fontSize: 11,
    fontFamily: 'Outfit-SemiBold',
    color: '#8B7EF8',
    letterSpacing: 2.5,
  },
  dykFact: {
    fontSize: 20,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 30,
  },
  dykSub: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#9999A8',
    textAlign: 'center',
    marginTop: 4,
  },
  dykBtn: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  dykBtnText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});

