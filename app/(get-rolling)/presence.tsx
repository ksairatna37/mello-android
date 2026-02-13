/**
 * Get Rolling - Presence Screen
 * Conversational flow asking about feeling present
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

// Soft Green/Mint Aurora - Grounding & Present
const AURORA_GRADIENT = ['#E8F8F0', '#C0E8D8', '#68B898', '#386858', '#102820', '#90D8B8'] as const;
const AURORA_LOCATIONS = [0, 0.15, 0.38, 0.58, 0.82, 1] as const;
const AURORA_BLOBS = [
  // Bottom - deep forest
  '#081810',  // bottom center (deepest)
  '#102018',  // bottom
  // Middle - rich emerald
  '#284838',  // middle center
  '#48A078',  // middle left (mint glow)
  // Upper - ethereal mint
  '#A8E8C8',  // upper right (soft mint)
  '#D0F0E0',  // upper left (luminous seafoam)
  '#B8E0D0',  // upper center (pale jade)
  '#F0FFF8',  // very top (ethereal white-green)
  // Magical accents
  '#F8FFFC',  // top left corner (glowing freshness)
  '#58B088',  // left middle (spring green)
  '#406858',  // center (forest)
  '#182820',  // right lower (deep pine)
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

const TOTAL_STEPS = 8;
const CURRENT_STEP = 5;

export default function PresenceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [flowState, setFlowState] = useState<FlowState>('typing_indicator');
  const [userResponse, setUserResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showBottomIndicator, setShowBottomIndicator] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');

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

  const handleNext = () => router.push('/(get-rolling)/discomfort');
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

  const getAIResponse = () => {
    return `Those moments of stillness are precious.\n\nWe'll find more of them together, even in the chaos.\n\nOne breath at a time.`;
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
                Life moves so fast sometimes{'\n'}Let's slow down for a moment
              </Animated.Text>
            )}

            {showTitle && (
              <Animated.View style={titleAnimatedStyle}>
                <AnimatedText
                  text="When did you last feel truly at peace?"
                  style={styles.title}
                  activeColor="#FFFFFF"
                  delayPerWord={120}
                  wordDuration={300}
                />
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
                <Ionicons name="arrow-forward" size={28} color="#1A3828" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {showInput && (
          <View style={{ paddingBottom: insets.bottom + 10 }}>
            <ConversationalInput
              placeholder="Share a peaceful memory..."
              onSubmit={handleSubmit}
              onStartListening={handleStartListening}
              onStopListening={handleStopListening}
              isListening={isListening}
              accentColor="#2A5040"
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
  progressFill: { height: '100%', backgroundColor: '#48A078', borderRadius: 4 },
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

  liveTranscript: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#183020',
    marginTop: 32,
    marginBottom: 12,
  },

  userResponse: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#183020',
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
