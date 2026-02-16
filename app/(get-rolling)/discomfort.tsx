/**
 * Get Rolling - Discomfort Screen
 * Selection-based question about what's weighing on the user
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuroraGradient from '@/components/common/AuroraGradient';
import TypingIndicator from '@/components/get-rolling/TypingIndicator';
import SelectionCard from '@/components/get-rolling/SelectionCard';
import { getOnboardingData, updateOnboardingData } from '@/utils/onboardingStorage';

// ═══════════════════════════════════════════════════════════════════════════
// SAFE PERSONALIZATION - Reflect their words, never interpret
// ═══════════════════════════════════════════════════════════════════════════

// Personalized subtitles based on primary feeling (safe, reflective)
const FEELING_SUBTITLES: Record<string, string> = {
  anxious: "You mentioned feeling anxious\nI'm here to listen",
  stressed: "You mentioned feeling stressed\nTake your time with this",
  lonely: "You mentioned feeling disconnected\nYou're not alone right now",
  burnout: "You mentioned feeling worn out\nNo rush here",
  relationship: "You mentioned relationship stuff\nThis stays between us",
  sleep: "You mentioned trouble sleeping\nLet's talk about it",
  talk: "You wanted someone to talk to\nI'm listening",
  exploring: "You're exploring wellness\nI'm curious about you",
  other: "You're going through something\nI'm here",
  default: "Let's go a little deeper\nThis stays between us",
  multiple: "You're carrying a few things\nOne step at a time",
};

// Personalized titles/questions based on primary feeling
const FEELING_TITLES: Record<string, string> = {
  anxious: "What's been on your mind?",
  stressed: "What's been weighing on you?",
  lonely: "What's that been like for you?",
  burnout: "What's been taking your energy?",
  relationship: "What's been on your heart?",
  sleep: "What keeps you up at night?",
  talk: "What's on your mind?",
  exploring: "What brought you here today?",
  other: "What's been going on?",
  default: "What's been weighing on you lately?",
  multiple: "What feels most present right now?",
};

// Warmth modifiers based on mood intensity
const WARMTH_PHRASES: Record<number, string> = {
  0: '',
  1: '',
  2: 'Take your time.',
  3: "No rush. I'm here.",
};

// What's weighing on them - multi-select options
const DISCOMFORT_OPTIONS = [
  { id: 'cant-stop-thinking', label: "I can't stop thinking about something" },
  { id: 'feel-stuck', label: 'I feel stuck' },
  { id: 'exhausted', label: "I'm exhausted" },
  { id: 'feel-alone', label: 'I feel alone' },
  { id: 'overwhelmed', label: "I'm overwhelmed" },
  { id: 'dont-know', label: "I don't know what I need" },
  { id: 'multiple-things', label: 'Multiple things at once' },
  { id: 'just-need-space', label: 'I just need some space' },
];

// Deep Indigo & Golden Aurora - Hope in Darkness
const AURORA_GRADIENT = ['#F8F0E0', '#E8D0A8', '#B89058', '#584828', '#181020', '#D8B878'] as const;
const AURORA_LOCATIONS = [0, 0.15, 0.38, 0.58, 0.82, 1] as const;
const AURORA_BLOBS = [
  '#0C0818', '#141028', '#383048', '#A88048',
  '#E8C888', '#F8E8C8', '#D8C098', '#FFF8E8',
  '#FFFCF0', '#C89848', '#585068', '#1C1428',
];

type FlowState =
  | 'typing_indicator'
  | 'subtitle_slide_in'
  | 'indicator_fade_out'
  | 'title_slide_in'
  | 'show_options'
  | 'complete';

const TOTAL_STEPS = 5;
const CURRENT_STEP = 3;

export default function DiscomfortScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [flowState, setFlowState] = useState<FlowState>('typing_indicator');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  // Personalization state
  const [firstName, setFirstName] = useState<string>('');
  const [primaryFeeling, setPrimaryFeeling] = useState<string>('default');
  const [moodIntensity, setMoodIntensity] = useState<number>(0);

  // Load onboarding data for personalization
  useEffect(() => {
    const loadPersonalization = async () => {
      const data = await getOnboardingData();

      if (data.firstName) {
        setFirstName(data.firstName);
      }

      if (data.moodIntensity !== undefined) {
        setMoodIntensity(data.moodIntensity);
      }

      if (data.selectedFeelings && data.selectedFeelings.length > 0) {
        if (data.selectedFeelings.length === 1) {
          setPrimaryFeeling(data.selectedFeelings[0]);
        } else {
          setPrimaryFeeling('multiple');
        }
      }
    };

    loadPersonalization();
  }, []);

  const indicatorOpacity = useSharedValue(1);
  const indicatorHeight = useSharedValue(24);
  const subtitleTranslateY = useSharedValue(30);
  const subtitleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const titleOpacity = useSharedValue(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => {
      setFlowState('subtitle_slide_in');
      subtitleOpacity.value = withTiming(1, { duration: 400 });
      subtitleTranslateY.value = withTiming(0, { duration: 400 });
    }, 2000));

    timers.push(setTimeout(() => {
      setFlowState('indicator_fade_out');
      indicatorOpacity.value = withTiming(0, { duration: 400 });
      indicatorHeight.value = withTiming(0, { duration: 400 });
    }, 2800));

    timers.push(setTimeout(() => {
      setFlowState('title_slide_in');
      titleOpacity.value = withTiming(1, { duration: 500 });
      titleTranslateY.value = withTiming(0, { duration: 500 });
    }, 3200));

    timers.push(setTimeout(() => {
      setFlowState('show_options');
    }, 4000));

    return () => timers.forEach(clearTimeout);
  }, []);

  // Sort options: selected ones at top
  const sortedOptions = useMemo(() => {
    const selected = DISCOMFORT_OPTIONS.filter((opt) => selectedOptions.includes(opt.id));
    const unselected = DISCOMFORT_OPTIONS.filter((opt) => !selectedOptions.includes(opt.id));
    return [...selected, ...unselected];
  }, [selectedOptions]);

  const toggleOption = (id: string) => {
    setSelectedOptions((prev) =>
      prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selectedOptions.length > 0) {
      await updateOnboardingData({ discomfortReasons: selectedOptions });
      router.push('/(get-rolling)/inhale-exhale');
    }
  };

  const handleClose = () => router.replace('/(main)/chat');

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    height: indicatorHeight.value,
    overflow: 'hidden',
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  // Get personalized subtitle
  const getPersonalizedSubtitle = (): string => {
    return FEELING_SUBTITLES[primaryFeeling] || FEELING_SUBTITLES.default;
  };

  // Get personalized title
  const getPersonalizedTitle = (): string => {
    return FEELING_TITLES[primaryFeeling] || FEELING_TITLES.default;
  };

  // Get warmth phrase
  const getWarmthPhrase = (): string => {
    return WARMTH_PHRASES[moodIntensity] || '';
  };

  const showTypingIndicator = ['typing_indicator', 'subtitle_slide_in'].includes(flowState);
  const showSubtitle = flowState !== 'typing_indicator';
  const showTitle = ['title_slide_in', 'show_options', 'complete'].includes(flowState);
  const showOptions = ['show_options', 'complete'].includes(flowState);
  const canContinue = selectedOptions.length > 0;

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

        {/* Conversation Area */}
        <ScrollView
          style={styles.conversationArea}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <Animated.View style={indicatorAnimatedStyle}>
            {showTypingIndicator && <TypingIndicator />}
          </Animated.View>

          {showSubtitle && (
            <Animated.Text style={[styles.subtitle, subtitleAnimatedStyle]}>
              {getPersonalizedSubtitle()}
            </Animated.Text>
          )}

          {showTitle && (
            <Animated.View style={titleAnimatedStyle}>
              <Text style={styles.title}>{getPersonalizedTitle()}</Text>
              {moodIntensity >= 2 && (
                <Text style={styles.warmthPhrase}>{getWarmthPhrase()}</Text>
              )}
            </Animated.View>
          )}

          {/* Selection Options - Multi-select */}
          {showOptions && (
            <Animated.View
              style={styles.optionsContainer}
              entering={FadeIn.duration(400)}
            >
              <Text style={styles.helpText}>Select all that apply</Text>
              {sortedOptions.map((option) => (
                <SelectionCard
                  key={option.id}
                  label={option.label}
                  isSelected={selectedOptions.includes(option.id)}
                  onPress={() => toggleOption(option.id)}
                  accentColor="#5A4020"
                />
              ))}
            </Animated.View>
          )}
        </ScrollView>

        {/* Continue Button */}
        {showOptions && canContinue && (
          <Animated.View
            style={[styles.continueButtonContainer, { paddingBottom: insets.bottom + 16 }]}
            entering={FadeIn.duration(400)}
          >
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Ionicons name="arrow-forward" size={28} color="#3A2810" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  closeButton: { width: 48, height: 48, justifyContent: 'center' },
  progressContainer: { flex: 1, paddingHorizontal: 12 },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#C89848', borderRadius: 4 },
  stepText: { fontSize: 17, fontFamily: 'Outfit-SemiBold', color: '#FFF', minWidth: 60, textAlign: 'right' },
  stepTextLight: { fontFamily: 'Outfit-Regular', color: 'rgba(255,255,255,0.7)' },

  conversationArea: { paddingTop: 20 },

  subtitle: {
    fontSize: 17,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 6,
  },

  title: {
    fontSize: 32,
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
    lineHeight: 40,
    marginBottom: 8,
  },

  warmthPhrase: {
    fontSize: 17,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },

  helpText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16,
  },

  optionsContainer: {
    gap: 12,
    marginTop: 16,
  },

  continueButtonContainer: {
    position: 'absolute',
    bottom: 0,
    right: 24,
  },
  continueButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
