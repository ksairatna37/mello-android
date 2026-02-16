/**
 * Get Rolling - Age Screen
 * Selection-based age range picker
 */

import React, { useState, useEffect } from 'react';
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
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { getOnboardingData, updateOnboardingData } from '@/utils/onboardingStorage';

// ═══════════════════════════════════════════════════════════════════════════
// SAFE PERSONALIZATION PHILOSOPHY
// ═══════════════════════════════════════════════════════════════════════════
// - Reflect their words, never interpret
// - Use firstName for warm greeting if available
// - Adjust pace based on moodIntensity (warmth, not psychology)
// ═══════════════════════════════════════════════════════════════════════════

// Warmth phrases for high intensity users
const WARMTH_PHRASES: Record<number, string> = {
  0: '', // Calm
  1: '', // Finding rhythm
  2: 'Take your time.', // Carrying a lot
  3: "There's no rush here.", // Struggling
};

// Age range options
const AGE_OPTIONS = [
  { id: 'under-18', label: 'Under 18' },
  { id: '18-24', label: '18 - 24' },
  { id: '25-34', label: '25 - 34' },
  { id: '35-44', label: '35 - 44' },
  { id: '45-54', label: '45 - 54' },
  { id: '55+', label: '55+' },
];

type FlowState =
  | 'typing_indicator'
  | 'subtitle_slide_in'
  | 'indicator_fade_out'
  | 'title_slide_in'
  | 'show_options'
  | 'complete';

const TOTAL_STEPS = 5;

export default function AgeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [flowState, setFlowState] = useState<FlowState>('typing_indicator');
  const [selectedAge, setSelectedAge] = useState<string | null>(null);

  // Personalization state
  const [firstName, setFirstName] = useState<string | null>(null);
  const [moodIntensity, setMoodIntensity] = useState<number>(0);

  // Load personalization data
  useEffect(() => {
    const loadPersonalization = async () => {
      try {
        const data = await getOnboardingData();
        if (data.firstName) setFirstName(data.firstName);
        if (typeof data.moodIntensity === 'number') {
          setMoodIntensity(data.moodIntensity);
        }
      } catch (e) {
        console.log('Failed to load personalization:', e);
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

  const handleSelectAge = async (id: string) => {
    setSelectedAge(id);
    // Save to storage
    await updateOnboardingData({ ageRange: id });
    // Brief delay then navigate
    setTimeout(() => {
      router.push('/(get-rolling)/avatar-analysis');
    }, 400);
  };

  const handleClose = () => router.push('/(get-rolling)/avatar-analysis');

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
  const getSubtitle = () => {
    const warmthPhrase = WARMTH_PHRASES[moodIntensity] || '';
    const nameGreeting = firstName ? `Hi ${firstName}. ` : '';
    const base = `${nameGreeting}This helps me understand\nwhere you are in life`;
    return warmthPhrase ? `${base}\n${warmthPhrase}` : base;
  };

  const showTypingIndicator = ['typing_indicator', 'subtitle_slide_in'].includes(flowState);
  const showSubtitle = flowState !== 'typing_indicator';
  const showTitle = ['title_slide_in', 'show_options', 'complete'].includes(flowState);
  const showOptions = ['show_options', 'complete'].includes(flowState);

  return (
    <View style={styles.container}>
      <AuroraGradient />

      <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(1 / TOTAL_STEPS) * 100}%` }]} />
            </View>
          </View>

          <Text style={styles.stepText}>
            1 <Text style={styles.stepTextLight}>of {TOTAL_STEPS}</Text>
          </Text>
        </View>

        {/* Conversation Area with Content Fade */}
        <FadingScrollWrapper topFadeHeight={50} bottomFadeHeight={80}>
          <ScrollView
            style={styles.conversationArea}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60, paddingTop: 25 }}
          >
            <Animated.View style={indicatorAnimatedStyle}>
              {showTypingIndicator && <TypingIndicator />}
            </Animated.View>

            {showSubtitle && (
              <Animated.Text style={[styles.subtitle, subtitleAnimatedStyle]}>
                {getSubtitle()}
              </Animated.Text>
            )}

            {showTitle && (
              <Animated.Text style={[styles.title, titleAnimatedStyle]}>
                How old are you?
              </Animated.Text>
            )}

            {/* Selection Options */}
            {showOptions && (
              <Animated.View
                style={styles.optionsContainer}
                entering={FadeIn.duration(400)}
              >
                {AGE_OPTIONS.map((option) => (
                  <SelectionCard
                    key={option.id}
                    label={option.label}
                    isSelected={selectedAge === option.id}
                    onPress={() => handleSelectAge(option.id)}
                    accentColor="#2D1525"
                  />
                ))}
              </Animated.View>
            )}
          </ScrollView>
        </FadingScrollWrapper>
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
    marginBottom: 16,
  },
  closeButton: { width: 48, height: 48, justifyContent: 'center' },
  progressContainer: { flex: 1, paddingHorizontal: 12 },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#6B3B4A', borderRadius: 4 },
  stepText: { fontSize: 17, fontFamily: 'Outfit-SemiBold', color: '#FFF', minWidth: 60, textAlign: 'right' },
  stepTextLight: { fontFamily: 'Outfit-Regular', color: 'rgba(255,255,255,0.7)' },

  conversationArea: { flex: 1 },

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
    marginBottom: 24,
  },

  optionsContainer: {
    gap: 12,
  },
});
