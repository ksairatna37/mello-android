/**
 * Get Rolling - Avatar Analysis Screen
 * Selection-based question about avatar choice
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuroraGradient from '@/components/common/AuroraGradient';
import TypingIndicator from '@/components/get-rolling/TypingIndicator';
import SelectionCard from '@/components/get-rolling/SelectionCard';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { getOnboardingData, updateOnboardingData } from '@/utils/onboardingStorage';

// Purple/violet aurora - VERSION 4 (Ethereal Dream)
const AURORA_GRADIENT = ['#E0D0F0', '#D8B8E0', '#A878B8', '#5A3878', '#1A1040', '#6A4080'] as const;
const AURORA_LOCATIONS = [0, 0.15, 0.38, 0.58, 0.82, 1] as const;
const AURORA_BLOBS = [
  '#120830', '#1A1045', '#4A2868', '#f0a8a8',
  '#E8A8C8', '#D8C0F0', '#C8A8D8', '#E8D8F8',
  '#F0E0F8', '#8A4888', '#6A4080', '#2A1850',
];

// ═══════════════════════════════════════════════════════════════════════════
// SAFE PERSONALIZATION PHILOSOPHY
// ═══════════════════════════════════════════════════════════════════════════
// - Reflect their words, never interpret
// - Use firstName for warm greeting if available
// - Adjust pace based on moodIntensity (warmth, not psychology)
// ═══════════════════════════════════════════════════════════════════════════

// Warmth phrases for high intensity users
const WARMTH_PHRASES: Record<number, string> = {
  0: '',
  1: '',
  2: 'Take your time.',
  3: "No pressure. I'm just curious.",
};

// Avatar choice options
const AVATAR_OPTIONS = [
  { id: 'feels-like-me', label: 'It feels like me' },
  { id: 'just-liked', label: 'I just liked it' },
  { id: 'matches-mood', label: 'It matches my mood' },
  { id: 'calming', label: "It's calming" },
  { id: 'no-reason', label: 'No specific reason' },
];

type FlowState =
  | 'typing_indicator'
  | 'subtitle_slide_in'
  | 'indicator_fade_out'
  | 'title_slide_in'
  | 'show_options'
  | 'complete';

const TOTAL_STEPS = 5;
const CURRENT_STEP = 2;

// Inline avatar size
const INLINE_AVATAR_SIZE = 32;
// Zoomed avatar size
const ZOOMED_AVATAR_SIZE = SCREEN_WIDTH * 0.7;

type AvatarData = {
  type: 'emoji' | 'icon' | 'image' | null;
  value: string | null;
};

export default function AvatarAnalysisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [flowState, setFlowState] = useState<FlowState>('typing_indicator');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
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
        const stored = await AsyncStorage.getItem('userAvatar');
        if (stored) {
          const parsed = JSON.parse(stored);
          setAvatar({ type: parsed.type, value: parsed.value });
        }

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

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const zoomedAvatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }],
  }));

  const handleSelectOption = async (id: string) => {
    setSelectedOption(id);
    await updateOnboardingData({ avatarReason: id });
    setTimeout(() => {
      router.push('/(get-rolling)/discomfort');
    }, 400);
  };

  const handleClose = () => router.push('/(get-rolling)/discomfort');

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
    const base = "I noticed you chose an avatar\nI'd love to know more";
    return warmthPhrase ? `${base}\n${warmthPhrase}` : base;
  };

  // Render inline avatar (tappable to zoom)
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

  const showTypingIndicator = ['typing_indicator', 'subtitle_slide_in'].includes(flowState);
  const showSubtitle = flowState !== 'typing_indicator';
  const showTitle = ['title_slide_in', 'show_options', 'complete'].includes(flowState);
  const showOptions = ['show_options', 'complete'].includes(flowState);

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
              <Animated.View style={titleAnimatedStyle}>
                <Text style={styles.title}>
                  What made you pick that {renderInlineAvatar()} picture?
                </Text>
              </Animated.View>
            )}

            {/* Selection Options */}
            {showOptions && (
              <Animated.View
                style={styles.optionsContainer}
                entering={FadeIn.duration(400)}
              >
                {AVATAR_OPTIONS.map((option) => (
                  <SelectionCard
                    key={option.id}
                    label={option.label}
                    isSelected={selectedOption === option.id}
                    onPress={() => handleSelectOption(option.id)}
                  accentColor="#4A2868"
                />
              ))}
            </Animated.View>
          )}
          </ScrollView>
        </FadingScrollWrapper>
      </View>

      {/* Avatar Zoom Modal */}
      <Modal
        visible={showZoomModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeZoomModal}
      >
        <TouchableWithoutFeedback onPress={closeZoomModal}>
          <View style={styles.zoomModalContainer}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.blurBackdrop, backdropAnimatedStyle]}>
              <BlurView
                intensity={100}
                tint="dark"
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

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
  progressFill: { height: '100%', backgroundColor: '#412974', borderRadius: 4 },
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
    lineHeight: 42,
    marginBottom: 24,
  },

  // Inline avatar styles
  inlineAvatarContainer: {
    width: INLINE_AVATAR_SIZE,
    height: INLINE_AVATAR_SIZE,
    borderRadius: INLINE_AVATAR_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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

  optionsContainer: {
    gap: 12,
  },

  // Zoom Modal styles
  zoomModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurBackdrop: {
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
