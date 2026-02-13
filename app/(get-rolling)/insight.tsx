/**
 * Get Rolling - Insight Screen
 * Final conversational screen sharing a personalized insight
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuroraGradient from '@/components/common/AuroraGradient';
import TypingIndicator from '@/components/get-rolling/TypingIndicator';
import AnimatedText from '@/components/get-rolling/AnimatedText';

// Soft Lavender/Periwinkle Aurora - Wisdom & Reflection
const AURORA_GRADIENT = ['#F0E8F8', '#D8C8E8', '#A888C8', '#684888', '#281838', '#C8A8D8'] as const;
const AURORA_LOCATIONS = [0, 0.15, 0.38, 0.58, 0.82, 1] as const;
const AURORA_BLOBS = [
  // Bottom - deep violet
  '#180820',  // bottom center (deepest night)
  '#201030',  // bottom
  // Middle - rich purple
  '#403058',  // middle center (twilight)
  '#8868A8',  // middle left (lavender glow)
  // Upper - ethereal periwinkle
  '#C8B8E0',  // upper right (soft lavender)
  '#E0D0F0',  // upper left (luminous lilac)
  '#D0C0E8',  // upper center (pale wisteria)
  '#F8F0FF',  // very top (ethereal white-violet)
  // Magical accents
  '#FFF8FF',  // top left corner (glowing dawn)
  '#9878B8',  // left middle (amethyst accent)
  '#585078',  // center (dusk purple)
  '#281840',  // right lower (deep violet)
];

type FlowState =
  | 'typing_indicator'
  | 'subtitle_slide_in'
  | 'indicator_fade_out'
  | 'title_slide_in'
  | 'typing_reply'
  | 'show_reply'
  | 'complete';

const TOTAL_STEPS = 8;
const CURRENT_STEP = 8;

export default function InsightScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [flowState, setFlowState] = useState<FlowState>('typing_indicator');
  const [showBottomIndicator, setShowBottomIndicator] = useState(true);

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
    }, 3000));

    timers.push(setTimeout(() => {
      setFlowState('indicator_fade_out');
      indicatorOpacity.value = withTiming(0, { duration: 400 });
      indicatorHeight.value = withTiming(0, { duration: 400 });
    }, 4000));

    timers.push(setTimeout(() => {
      setFlowState('title_slide_in');
      titleOpacity.value = withTiming(1, { duration: 500 });
      titleTranslateY.value = withTiming(0, { duration: 500 });
    }, 4500));

    timers.push(setTimeout(() => {
      setFlowState('typing_reply');
    }, 6500));

    timers.push(setTimeout(() => {
      setFlowState('show_reply');
    }, 8500));

    timers.push(setTimeout(() => {
      setFlowState('complete');
    }, 9500));

    timers.push(setTimeout(() => {
      setShowBottomIndicator(false);
    }, 14500));

    return () => timers.forEach(clearTimeout);
  }, []);

  const handleComplete = () => router.replace('/(main)/chat');
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

  const showTypingIndicator = ['typing_indicator', 'subtitle_slide_in'].includes(flowState);
  const showSubtitle = flowState !== 'typing_indicator';
  const showTitle = ['title_slide_in', 'typing_reply', 'show_reply', 'complete'].includes(flowState);
  const showTypingReply = flowState === 'typing_reply';
  const showAIReply = ['show_reply', 'complete'].includes(flowState);
  const showCompleteButton = flowState === 'complete';

  const getInsightMessage = () => {
    return `You're not broken, you're becoming.\n\nEvery answer you shared shows someone ready to grow, ready to heal, ready to be seen.\n\nI'm honored to walk this path with you.`;
  };

  return (
    <View style={styles.container}>
      <AuroraGradient
        gradientColors={AURORA_GRADIENT}
        gradientLocations={AURORA_LOCATIONS}
        blobColors={AURORA_BLOBS}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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

          {/* Conversation */}
          <ScrollView
            style={styles.conversationArea}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <Animated.View style={indicatorAnimatedStyle}>
              {showTypingIndicator && <TypingIndicator />}
            </Animated.View>

            {showSubtitle && (
              <Animated.Text style={[styles.subtitle, subtitleAnimatedStyle]}>
                I've been listening carefully{'\n'}Here's what I see in you
              </Animated.Text>
            )}

            {showTitle && (
              <Animated.View style={titleAnimatedStyle}>
                <AnimatedText
                  text="Something beautiful is already happening..."
                  style={styles.title}
                  activeColor="#FFFFFF"
                  delayPerWord={120}
                  wordDuration={300}
                />
              </Animated.View>
            )}

            {showTypingReply && (
              <Animated.View style={styles.replyTyping} entering={FadeIn.duration(300)}>
                <TypingIndicator />
              </Animated.View>
            )}

            {showAIReply && (
              <View style={styles.aiResponse}>
                <AnimatedText
                  text={getInsightMessage()}
                  style={styles.aiText}
                  activeColor="#FFFFFF"
                  startDelay={700}
                  paragraphDelay={1500}
                />
              </View>
            )}

            {showAIReply && showBottomIndicator && (
              <Animated.View
                style={styles.bottomTyping}
                entering={FadeIn.delay(800).duration(300)}
                exiting={FadeOut.duration(400)}
              >
                <TypingIndicator />
              </Animated.View>
            )}
          </ScrollView>

          {/* Complete Button */}
          {showCompleteButton && (
            <Animated.View
              style={styles.completeButtonContainer}
              entering={FadeIn.duration(400)}
            >
              <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
                <Text style={styles.completeButtonText}>Begin My Journey</Text>
                <Ionicons name="sparkles" size={20} color="#3A2850" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
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
  progressFill: { height: '100%', backgroundColor: '#9878B8', borderRadius: 4 },
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
  },

  replyTyping: { marginTop: 24 },

  aiResponse: { marginTop: 24, gap: 14 },

  aiText: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
  },

  bottomTyping: { marginTop: 24 },

  completeButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  completeButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#3A2850',
  },
});
