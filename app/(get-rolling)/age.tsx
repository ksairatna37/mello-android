/**
 * Get Rolling - Age Screen (Conversational)
 * FIXED LAYOUT VERSION
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Easing,
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

export default function AgeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [flowState, setFlowState] = useState<FlowState>('typing_indicator');
  const [userResponse, setUserResponse] = useState('');
  const [extractedAge, setExtractedAge] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [showBottomIndicator, setShowBottomIndicator] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');

  // Debounce timer for auto-submit (3 seconds of silence)
  const SILENCE_TIMEOUT_MS = 3000;
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef<string>('');

  // Clear silence timer
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // Speech recognition event handlers
  useSpeechRecognitionEvent('start', () => {
    console.log('[Speech] Started');
    setIsListening(true);
    finalTranscriptRef.current = '';
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('[Speech] Ended');
    clearSilenceTimer();

    // Submit final transcript if available
    if (finalTranscriptRef.current.trim()) {
      handleSubmit(finalTranscriptRef.current.trim());
      setLiveTranscript('');
      finalTranscriptRef.current = '';
    }
    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript || '';
    console.log('[Speech] Result:', transcript, 'isFinal:', event.isFinal);

    setLiveTranscript(transcript);
    finalTranscriptRef.current = transcript;

    // Reset the silence timer on each new result
    clearSilenceTimer();

    // Start a new silence timer - auto-submit after 3 seconds of no new speech
    silenceTimerRef.current = setTimeout(() => {
      if (finalTranscriptRef.current.trim() && isListening) {
        console.log('[Speech] Silence timeout - auto submitting');
        ExpoSpeechRecognitionModule.stop();
      }
    }, SILENCE_TIMEOUT_MS);
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.log('[Speech] Error:', event.error, event.message);
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

  const extractAge = (text: string): number | null => {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  const handleSubmit = (text: string) => {
    setUserResponse(text);
    const age = extractAge(text);
    setExtractedAge(age);
    setFlowState('user_responded');

    setTimeout(() => setFlowState('typing_reply'), 800);
    setTimeout(() => setFlowState('show_reply'), 2500);
    setTimeout(() => setFlowState('complete'), 3500);
    setTimeout(() => setShowBottomIndicator(false), 8500);
  };

  const handleStartListening = async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        console.log('[Speech] Permission denied');
        return;
      }

      // Clear any previous state
      setLiveTranscript('');
      finalTranscriptRef.current = '';
      clearSilenceTimer();

      // Start speech recognition with realtime results
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,  // Enable realtime partial results
        continuous: true,      // Keep listening until manually stopped or silence timeout
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

  const handleNext = () => router.push('/(get-rolling)/avatar-analysis');
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

  return (
    <View style={styles.container}>
      <AuroraGradient />

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
                <View style={[styles.progressFill, { width: `${(1 / TOTAL_STEPS) * 100}%` }]} />
              </View>
            </View>

            <Text style={styles.stepText}>
              1 <Text style={styles.stepTextLight}>of {TOTAL_STEPS}</Text>
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
                This helps me understand{'\n'}where you are in life
              </Animated.Text>
            )}

            {showTitle && (
              <Animated.View style={titleAnimatedStyle}>
                <AnimatedText
                  text="How old are you?"
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
                  // text={`Thank you for sharing that with me.\n\nThere's so much becoming and discovering in this part of life.\n\nI'm here to walk alongside you through it all.\n\nthank you again`}
                  text={`Thank you for sharing that with me.`}
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
                <Ionicons name="arrow-forward" size={28} color="#2D1525" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {showInput && (
          <View style={{ paddingBottom: insets.bottom + 10 }}>
            <ConversationalInput
              placeholder="Share your age here..."
              onSubmit={handleSubmit}
              onStartListening={handleStartListening}
              onStopListening={handleStopListening}
              isListening={isListening}
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
  progressFill: { height: '100%', backgroundColor: '#6B3B4A', borderRadius: 4 },
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
    color: '#2D1525',
    marginTop: 32,
    marginBottom: 12,
  },

  userResponse: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#2D1525',
    marginTop: 32,
    marginBottom: 12,
  },

  replyTyping: { marginTop: 16 },

  aiResponse: { marginTop: 16, gap: 14 },

  aiAgeRow: { flexDirection: 'row', alignItems: 'center' },
  aiAgeText: { fontSize: 28, fontFamily: 'Outfit-Bold', color: '#FFF' },
  heartIcon: { marginLeft: 8 },

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
