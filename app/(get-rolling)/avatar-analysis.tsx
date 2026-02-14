/**
 * Get Rolling - Avatar Analysis Screen
 * Asks user about their avatar choice to understand them deeper
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useSpeechRecognitionEvent,
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition';

import AuroraGradient from '@/components/common/AuroraGradient';

// Purple/violet aurora - VERSION 4 (Ethereal Dream)
// Crafted for the prettiest, most beautiful look
const AURORA_GRADIENT = ['#E0D0F0', '#D8B8E0', '#A878B8', '#5A3878', '#1A1040', '#6A4080'] as const;
const AURORA_LOCATIONS = [0, 0.15, 0.38, 0.58, 0.82, 1] as const;
const AURORA_BLOBS = [
  // Bottom - luxurious midnight
  '#120830',  // bottom center (deepest midnight)
  '#1A1045',  // bottom (rich indigo)
  // Middle - rich purple dream
  '#4A2868',  // middle center (royal purple)
  '#f0a8a8',  // middle left (orchid magenta)
  // Upper - ethereal glow
  '#E8A8C8',  // upper right (soft blush rose)
  '#D8C0F0',  // upper left (luminous lavender)
  '#C8A8D8',  // upper center (lilac dream)
  '#E8D8F8',  // very top (ethereal white-lavender)
  // Magical accents
  '#F0E0F8',  // top left corner (glowing white-pink)
  '#8A4888',  // left middle (fuchsia glow)
  '#6A4080',  // center (deep violet)
  '#2A1850',  // right lower (midnight purple)
];
import TypingIndicator from '@/components/get-rolling/TypingIndicator';
import ConversationalInput from '@/components/get-rolling/ConversationalInput';
import AnimatedText from '@/components/get-rolling/AnimatedText';
import { getOnboardingData } from '@/utils/onboardingStorage';

// ═══════════════════════════════════════════════════════════════════════════
// SAFE PERSONALIZATION PHILOSOPHY
// ═══════════════════════════════════════════════════════════════════════════
// - Reflect their words, never interpret
// - Use firstName for warm greeting if available
// - Adjust pace based on moodIntensity (warmth, not psychology)
// ═══════════════════════════════════════════════════════════════════════════

// Warmth phrases for high intensity users - presence, not interpretation
const WARMTH_PHRASES: Record<number, string> = {
  0: '', // Calm
  1: '', // Finding rhythm
  2: 'Take your time.', // Carrying a lot
  3: "No pressure. I'm just curious.", // Struggling
};

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
const CURRENT_STEP = 2;

// Inline avatar size (slightly smaller than font-size for clean inline fit)
const INLINE_AVATAR_SIZE = 32;

// Zoomed avatar size (Instagram-style large preview)
const ZOOMED_AVATAR_SIZE = SCREEN_WIDTH * 0.7;

type AvatarData = {
  type: 'emoji' | 'icon' | 'image' | null;
  value: string | null;
};

export default function AvatarAnalysisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [flowState, setFlowState] = useState<FlowState>('typing_indicator');
  const [userResponse, setUserResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showBottomIndicator, setShowBottomIndicator] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [avatar, setAvatar] = useState<AvatarData>({ type: null, value: null });

  // Personalization state
  const [firstName, setFirstName] = useState<string | null>(null);
  const [moodIntensity, setMoodIntensity] = useState<number>(0);

  // Avatar zoom modal state
  const [showZoomModal, setShowZoomModal] = useState(false);
  const zoomScale = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  // Load avatar and personalization from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load avatar from legacy key for backwards compatibility
        const stored = await AsyncStorage.getItem('userAvatar');
        if (stored) {
          const parsed = JSON.parse(stored);
          setAvatar({ type: parsed.type, value: parsed.value });
        }

        // Load personalization data
        const data = await getOnboardingData();
        if (data.firstName) setFirstName(data.firstName);
        if (typeof data.moodIntensity === 'number') {
          setMoodIntensity(data.moodIntensity);
        }
      } catch (e) {
        console.log('Failed to load data:', e);
      }
    };
    loadData();
  }, []);

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

  // Avatar zoom handlers
  const openZoomModal = () => {
    setShowZoomModal(true);
    backdropOpacity.value = withTiming(1, { duration: 250 });
    zoomScale.value = withTiming(1, {
      duration: 250,
      easing: Easing.out(Easing.ease),
    });
  };

  const closeZoomModal = () => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    zoomScale.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.ease),
    }, () => {
      runOnJS(setShowZoomModal)(false);
    });
  };

  // Animated styles for zoom modal
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const zoomedAvatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }],
  }));

  // Get personalized subtitle
  const getSubtitle = () => {
    const warmthPhrase = WARMTH_PHRASES[moodIntensity] || '';
    const base = "I noticed you chose an avatar\nI'd love to know more";
    return warmthPhrase ? `${base}\n${warmthPhrase}` : base;
  };

  // Generate contextual AI response - warm without interpreting
  const getAIResponse = () => {
    const namePrefix = firstName ? `${firstName}, that's ` : "That's ";
    return `${namePrefix}beautiful.\n\nThank you for sharing that with me.\n\nI appreciate you letting me see a little more of you.`;
  };

  // Render inline avatar for the title - tappable to zoom
  const renderInlineAvatar = () => {
    if (!avatar.value) return null;

    return (
      <View
        style={styles.inlineAvatarContainer}
        onStartShouldSetResponder={() => true}
        onResponderRelease={openZoomModal}
      >
        {avatar.type === 'emoji' && (
          <Text style={styles.inlineAvatarEmoji}>{avatar.value}</Text>
        )}
        {avatar.type === 'icon' && (
          <Ionicons name={avatar.value as any} size={22} color="#FFFFFF" />
        )}
        {avatar.type === 'image' && (
          <Image source={{ uri: avatar.value }} style={styles.inlineAvatarImage} />
        )}
      </View>
    );
  };

  // Render zoomed avatar content
  const renderZoomedAvatar = () => {
    if (!avatar.value) return null;

    return (
      <>
        {avatar.type === 'emoji' && (
          <Text style={styles.zoomedAvatarEmoji}>{avatar.value}</Text>
        )}
        {avatar.type === 'icon' && (
          <Ionicons name={avatar.value as any} size={ZOOMED_AVATAR_SIZE * 0.6} color="#FFFFFF" />
        )}
        {avatar.type === 'image' && (
          <Image source={{ uri: avatar.value }} style={styles.zoomedAvatarImage} />
        )}
      </>
    );
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
                {getSubtitle()}
              </Animated.Text>
            )}

            {showTitle && (
              <Animated.View style={titleAnimatedStyle}>
                <Text style={styles.title}>
                  What made you pick that {renderInlineAvatar()} picture?
                </Text>
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
                <Ionicons name="arrow-forward" size={28} color="#4A2868" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {showInput && (
          <View style={{ paddingBottom: insets.bottom + 10 }}>
            <ConversationalInput
              placeholder="Share your thoughts..."
              onSubmit={handleSubmit}
              onStartListening={handleStartListening}
              onStopListening={handleStopListening}
              isListening={isListening}
              accentColor="#2A1850"
            />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Avatar Zoom Modal - Instagram style */}
      <Modal
        visible={showZoomModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeZoomModal}
      >
        <TouchableWithoutFeedback onPress={closeZoomModal}>
          <View style={styles.zoomModalContainer}>
            {/* Blur Backdrop with dark fallback for Android */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.blurBackdrop, backdropAnimatedStyle]}>
              <BlurView
                intensity={100}
                tint="dark"
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            {/* Zoomed Avatar */}
            <Animated.View style={[styles.zoomedAvatarContainer, zoomedAvatarAnimatedStyle]}>
              {renderZoomedAvatar()}
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  progressFill: { height: '100%', backgroundColor: '#412974', borderRadius: 4 },
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
    lineHeight: 42,
  },

  // Inline avatar styles - sized to fit within text line
  inlineAvatarContainer: {
    width: INLINE_AVATAR_SIZE,
    height: INLINE_AVATAR_SIZE,
    borderRadius: INLINE_AVATAR_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // Vertical alignment for inline View in Text
    transform: [{ translateY: 6 }],
  },
  inlineAvatarEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  inlineAvatarImage: {
    width: INLINE_AVATAR_SIZE,
    height: INLINE_AVATAR_SIZE,
    borderRadius: INLINE_AVATAR_SIZE / 2,
  },

  liveTranscript: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#351A50',
    marginTop: 32,
    marginBottom: 12,
  },

  userResponse: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#351A50',
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

  // Zoom Modal styles (Instagram-style)
  zoomModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurBackdrop: {
    // Dark fallback for Android where BlurView may not work
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  zoomedAvatarContainer: {
    width: ZOOMED_AVATAR_SIZE,
    height: ZOOMED_AVATAR_SIZE,
    borderRadius: ZOOMED_AVATAR_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  zoomedAvatarEmoji: {
    fontSize: ZOOMED_AVATAR_SIZE * 0.6,
  },
  zoomedAvatarImage: {
    width: ZOOMED_AVATAR_SIZE,
    height: ZOOMED_AVATAR_SIZE,
    borderRadius: ZOOMED_AVATAR_SIZE / 2,
  },
});
