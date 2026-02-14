/**
 * Get Rolling - Discomfort Screen
 * Conversational flow asking about handling discomfort
 */

import React, { useState, useEffect, useRef } from 'react';
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
import {
  useSpeechRecognitionEvent,
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition';

import AuroraGradient from '@/components/common/AuroraGradient';
import TypingIndicator from '@/components/get-rolling/TypingIndicator';
import ConversationalInput from '@/components/get-rolling/ConversationalInput';
import AnimatedText from '@/components/get-rolling/AnimatedText';
import { getOnboardingData, OnboardingData } from '@/utils/onboardingStorage';

// ============================================================================
// SAFE PERSONALIZATION - Reflect their words, never interpret
// ============================================================================

// Maps feeling IDs to user-friendly phrases (THEIR words, reflected back)
const FEELING_PHRASES: Record<string, string> = {
  anxious: 'feeling anxious',
  stressed: 'feeling stressed',
  lonely: 'feeling disconnected',
  burnout: 'feeling worn out',
  relationship: 'relationship stuff on your mind',
  sleep: 'trouble sleeping',
  talk: 'wanting someone to talk to',
  exploring: 'exploring wellness',
  other: 'going through something',
};

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

// Personalized titles/questions based on primary feeling (gentle doors)
const FEELING_TITLES: Record<string, string> = {
  anxious: "What's been on your mind lately?",
  stressed: "What's been weighing on you?",
  lonely: "What's that been like for you?",
  burnout: "What's been taking your energy?",
  relationship: "What's been on your heart?",
  sleep: "What keeps you up at night?",
  talk: "What's on your mind?",
  exploring: "What brought you here today?",
  other: "What's been going on?",
  default: "What's been weighing on your heart lately?",
  multiple: "What feels most present right now?",
};

// Warmth modifiers based on mood intensity (adjusts tone, not content)
const WARMTH_PHRASES: Record<number, string> = {
  0: '', // Calm - no addition needed
  1: '', // Finding rhythm - no addition needed
  2: 'Take your time.', // Carrying a lot - gentle pace
  3: "No rush. I'm here.", // Struggling - maximum gentleness
};

// Deep Indigo & Golden Aurora - Hope in Darkness
const AURORA_GRADIENT = ['#F8F0E0', '#E8D0A8', '#B89058', '#584828', '#181020', '#D8B878'] as const;
const AURORA_LOCATIONS = [0, 0.15, 0.38, 0.58, 0.82, 1] as const;
const AURORA_BLOBS = [
  // Bottom - deep midnight indigo
  '#0C0818',  // bottom center (deepest night)
  '#141028',  // bottom
  // Middle - rich amber/bronze
  '#383048',  // middle center (dusk purple)
  '#A88048',  // middle left (golden glow)
  // Upper - warm golden light
  '#E8C888',  // upper right (soft gold)
  '#F8E8C8',  // upper left (luminous cream)
  '#D8C098',  // upper center (warm sand)
  '#FFF8E8',  // very top (ethereal sunrise)
  // Magical accents
  '#FFFCF0',  // top left corner (glowing dawn)
  '#C89848',  // left middle (amber accent)
  '#585068',  // center (twilight purple)
  '#1C1428',  // right lower (deep indigo)
];

type FlowState =
  | 'typing_indicator'
  | 'subtitle_slide_in'
  | 'indicator_fade_out'
  | 'title_slide_in'
  | 'show_input'
  | 'user_responded'
  | 'typing_reply'
  | 'show_reply'
  | 'complete';

const TOTAL_STEPS = 5;
const CURRENT_STEP = 3;

export default function DiscomfortScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [flowState, setFlowState] = useState<FlowState>('typing_indicator');
  const [userResponse, setUserResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showBottomIndicator, setShowBottomIndicator] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');

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

      // Determine primary feeling
      if (data.selectedFeelings && data.selectedFeelings.length > 0) {
        if (data.selectedFeelings.length === 1) {
          setPrimaryFeeling(data.selectedFeelings[0]);
        } else {
          // Multiple feelings - use 'multiple' variant
          setPrimaryFeeling('multiple');
        }
      }
    };

    loadPersonalization();
  }, []);

  // Get personalized subtitle (safe - reflects their words)
  const getPersonalizedSubtitle = (): string => {
    const baseSubtitle = FEELING_SUBTITLES[primaryFeeling] || FEELING_SUBTITLES.default;
    return baseSubtitle;
  };

  // Get personalized title (safe - opens a door, doesn't interpret)
  const getPersonalizedTitle = (): string => {
    return FEELING_TITLES[primaryFeeling] || FEELING_TITLES.default;
  };

  // Get warmth phrase based on mood intensity
  const getWarmthPhrase = (): string => {
    return WARMTH_PHRASES[moodIntensity] || '';
  };

  const SILENCE_TIMEOUT_MS = 3000;
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef<string>('');

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    finalTranscriptRef.current = '';
  });

  useSpeechRecognitionEvent('end', () => {
    clearSilenceTimer();
    if (finalTranscriptRef.current.trim()) {
      handleSubmit(finalTranscriptRef.current.trim());
      setLiveTranscript('');
      finalTranscriptRef.current = '';
    }
    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript || '';
    setLiveTranscript(transcript);
    finalTranscriptRef.current = transcript;

    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (finalTranscriptRef.current.trim() && isListening) {
        ExpoSpeechRecognitionModule.stop();
      }
    }, SILENCE_TIMEOUT_MS);
  });

  useSpeechRecognitionEvent('error', () => {
    clearSilenceTimer();
    setIsListening(false);
    setLiveTranscript('');
    finalTranscriptRef.current = '';
  });

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
      setFlowState('show_input');
    }, 5500));

    return () => timers.forEach(clearTimeout);
  }, []);

  const handleSubmit = (text: string) => {
    setUserResponse(text);
    setFlowState('user_responded');

    setTimeout(() => setFlowState('typing_reply'), 800);
    setTimeout(() => setFlowState('show_reply'), 2500);
    setTimeout(() => setFlowState('complete'), 3500);
    setTimeout(() => setShowBottomIndicator(false), 8500);
  };

  const handleStartListening = async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) return;

      setLiveTranscript('');
      finalTranscriptRef.current = '';
      clearSilenceTimer();

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
      });
    } catch (error) {
      console.log('[Speech] Start error:', error);
    }
  };

  const handleStopListening = () => {
    clearSilenceTimer();
    ExpoSpeechRecognitionModule.stop();
  };

  // Go to breathing exercise
  const handleNext = () => router.push('/(get-rolling)/inhale-exhale');
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
  const showTitle = ['title_slide_in', 'show_input', 'user_responded', 'typing_reply', 'show_reply', 'complete'].includes(flowState);
  const showInput = flowState === 'show_input';
  const showLiveTranscript = flowState === 'show_input' && isListening && liveTranscript.trim().length > 0;
  const showUserResponse = ['user_responded', 'typing_reply', 'show_reply', 'complete'].includes(flowState);
  const showTypingReply = flowState === 'typing_reply';
  const showAIReply = ['show_reply', 'complete'].includes(flowState);
  const showNextButton = flowState === 'complete';

  // AI response - safe, warm, never interprets
  const getAIResponse = () => {
    // Base response - acknowledges without interpreting
    const baseResponse = "Thank you for sharing that with me.";

    // Warmth varies by intensity (presence, not psychology)
    if (moodIntensity >= 2) {
      // Higher intensity - more gentle presence
      return `${baseResponse}\n\nThat took courage to say.\n\nI'm here with you.`;
    }

    // Normal intensity - simple acknowledgment
    return `${baseResponse}\n\nI hear you.\n\nLet's take the next step together.`;
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
                {getPersonalizedSubtitle()}
              </Animated.Text>
            )}

            {showTitle && (
              <Animated.View style={titleAnimatedStyle}>
                <AnimatedText
                  text={getPersonalizedTitle()}
                  style={styles.title}
                  activeColor="#FFFFFF"
                  delayPerWord={120}
                  wordDuration={300}
                />
                {/* Warmth phrase for high intensity users */}
                {moodIntensity >= 2 && (
                  <Text style={styles.warmthPhrase}>{getWarmthPhrase()}</Text>
                )}
              </Animated.View>
            )}

            {showLiveTranscript && (
              <Text style={styles.liveTranscript}>{liveTranscript}</Text>
            )}

            {showUserResponse && (
              <Animated.Text
                style={styles.userResponse}
                entering={FadeIn.duration(400)}
              >
                {userResponse}
              </Animated.Text>
            )}

            {showTypingReply && (
              <Animated.View style={styles.replyTyping} entering={FadeIn.duration(300)}>
                <TypingIndicator />
              </Animated.View>
            )}

            {showAIReply && (
              <View style={styles.aiResponse}>
                <AnimatedText
                  text={getAIResponse()}
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

          {/* Next */}
          {showNextButton && (
            <Animated.View
              style={styles.nextButtonContainer}
              entering={FadeIn.duration(400)}
            >
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Ionicons name="arrow-forward" size={28} color="#3A2810" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {showInput && (
          <View style={{ paddingBottom: insets.bottom + 10 }}>
            <ConversationalInput
              placeholder="Be honest with yourself..."
              onSubmit={handleSubmit}
              onStartListening={handleStartListening}
              onStopListening={handleStopListening}
              isListening={isListening}
              accentColor="#5A4020"
            />
          </View>
        )}
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
  },

  warmthPhrase: {
    fontSize: 17,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
  },

  liveTranscript: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#3A2810',
    marginTop: 32,
    marginBottom: 12,
  },

  userResponse: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#3A2810',
    marginTop: 32,
    marginBottom: 12,
  },

  replyTyping: { marginTop: 16 },

  aiResponse: { marginTop: 16, gap: 14 },

  aiText: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
  },

  bottomTyping: { marginTop: 24 },

  nextButtonContainer: {
    position: 'absolute',
    bottom: -10,
    right: 22,
  },
  nextButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
