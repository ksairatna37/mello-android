/**
 * HomeScreen - Balanced home landing screen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, {
  Extrapolate,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LIGHT_THEME, CARD_SHADOW, CARD_SHADOW_LIGHT } from '@/components/common/LightGradient';
import MelloGradient from '@/components/common/MelloGradient';
import FadingScrollWrapper from '@/components/get-rolling/ScrollFadeEdges';
import DailyCheckInCard from '@/components/home/DailyCheckInCard';
import PrimaryToolCard from '@/components/home/PrimaryToolCard';
import SecondaryToolCard from '@/components/home/SecondaryToolCard';
import { getAvatar } from '@/utils/onboardingStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ZOOMED_AVATAR_SIZE = SCREEN_WIDTH * 0.6;
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const TODAY_FOCUS = [
  'Notice one thing that feels lighter than yesterday.',
  'You do not need to solve everything today, just stay with yourself kindly.',
  'A small check-in still counts as care.',
];

const RECENT_ACTIVITY_ITEMS = [
  {
    id: 'journal',
    icon: 'book-outline' as const,
    accentColor: LIGHT_THEME.cardYellow,
    textColor: '#8B7355',
    title: 'Write a quick journal note',
    subtitle: 'Capture what is on your mind',
    timestamp: '2 min ritual',
  },
  {
    id: 'mood',
    icon: 'pulse-outline' as const,
    accentColor: LIGHT_THEME.cardMint,
    textColor: '#4A7C6F',
    title: 'See your mood pattern',
    subtitle: 'Look at your weekly rhythm',
    timestamp: 'Last 7 days',
  },
  {
    id: 'breathing',
    icon: 'leaf-outline' as const,
    accentColor: LIGHT_THEME.cardPurple,
    textColor: '#6B5B95',
    title: 'Reset with breathing',
    subtitle: 'A short guided pause',
    timestamp: '3 min',
  },
  {
    id: 'chat',
    icon: 'chatbubble-outline' as const,
    accentColor: LIGHT_THEME.cardBlue,
    textColor: '#4A6B8C',
    title: 'Talk things through',
    subtitle: 'A calm conversation with mello',
    timestamp: 'Open now',
  },
];

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getTodayLabel() {
  const now = new Date();
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return `${weekdays[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
}

function getFocusMessage() {
  const dayIndex = new Date().getDate() % TODAY_FOCUS.length;
  return TODAY_FOCUS[dayIndex];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const scrollY = useSharedValue(0);

  const [avatar, setAvatar] = useState<{ type: string | null; value: string | null }>({
    type: null,
    value: null,
  });
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [checkInComplete, setCheckInComplete] = useState(false);

  const zoomScale = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    const loadAvatar = async () => {
      const avatarData = await getAvatar();
      setAvatar(avatarData);
    };

    loadAvatar();
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const logoAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [0, 120], [1, 0.78], Extrapolate.CLAMP);
    const translateY = interpolate(scrollY.value, [0, 120], [0, -4], Extrapolate.CLAMP);

    return {
      transform: [{ scale }, { translateY }],
    };
  });

  const openZoomModal = useCallback(() => {
    if (!avatar.value) return;

    setShowZoomModal(true);
    backdropOpacity.value = withTiming(1, { duration: 250 });
    zoomScale.value = withTiming(1, { duration: 250 });
  }, [avatar.value, backdropOpacity, zoomScale]);

  const closeZoomModal = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    zoomScale.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(setShowZoomModal)(false);
    });
  }, [backdropOpacity, zoomScale]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const zoomedAvatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }],
  }));

  const handleRecentPress = useCallback((id: string) => {
    if (id === 'journal') {
      router.navigate('/(main)/journal');
      return;
    }

    if (id === 'mood') {
      router.navigate('/(main)/mood-history');
      return;
    }

    if (id === 'breathing') {
      router.navigate('/(main)/breathing');
      return;
    }

    router.navigate('/(main)/chat');
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <MelloGradient />

      <FadingScrollWrapper topFadeHeight={44} bottomFadeHeight={88}>
        <AnimatedScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 12, paddingBottom: 88 + insets.bottom },
          ]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
            <View style={styles.headerContent}>
              <Animated.View style={logoAnimatedStyle}>
                <Text style={styles.logoText}>mello</Text>
              </Animated.View>

              <Pressable
                onLongPress={() => router.navigate('/(main)/settings')}
                onPress={openZoomModal}
                style={styles.profileButton}
              >
                <View style={styles.profileAvatar}>
                  {avatar.type === 'emoji' && avatar.value ? (
                    <Text style={styles.avatarEmoji}>{avatar.value}</Text>
                  ) : avatar.type === 'image' && avatar.value ? (
                    <Image source={{ uri: avatar.value }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons color={LIGHT_THEME.textSecondary} name="person" size={16} />
                  )}
                </View>
              </Pressable>
            </View>
          </Animated.View>

          <View style={styles.heroCard}>
            <LinearGradient
              colors={['rgba(186, 166, 255, 0)', 'rgba(186, 166, 255, 0.16)']}
              end={{ x: 0.5, y: 1 }}
              pointerEvents="none"
              start={{ x: 0.5, y: 0 }}
              style={styles.heroCardGlow}
            />

            <View style={styles.heroTopRow}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.eyebrow}>{getTodayLabel()}</Text>
                <Text style={styles.heroTitle}>{getGreeting()}</Text>
                <Text style={styles.heroSubtitle}>
                  Home is lighter now. Start with one small thing that helps.
                </Text>
              </View>

              <Pressable
                onPress={() => router.navigate('/(main)/settings')}
                style={styles.heroPill}
              >
                <Ionicons name="sparkles-outline" size={14} color={LIGHT_THEME.textPrimary} />
                <Text style={styles.heroPillText}>Your safe space</Text>
              </Pressable>
            </View>

            <View style={styles.focusPanel}>
              <Text style={styles.focusLabel}>Today&apos;s gentle focus</Text>
              <Text style={styles.focusText}>{getFocusMessage()}</Text>
            </View>

            <View style={styles.heroActions}>
              <Pressable
                onPress={() => router.navigate('/(main)/journal')}
                style={[styles.heroActionButton, styles.heroActionSecondary]}
              >
                <Text style={styles.heroActionSecondaryText}>Open journal</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Check in</Text>
              <Text style={styles.sectionCaption}>
                {checkInComplete ? 'Nice work. You showed up for yourself.' : 'One quick pulse for today.'}
              </Text>
            </View>
            <DailyCheckInCard onCheckInComplete={() => setCheckInComplete(true)} />
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Choose your next step</Text>
              <Text style={styles.sectionCaption}>
                Go straight into the support you need instead of scrolling through everything.
              </Text>
            </View>

            <View style={styles.primaryToolsRow}>
              <PrimaryToolCard
                accentColor="#7A8CFF"
                ctaText="Open chat"
                icon="chatbubble-ellipses-outline"
                onPress={() => router.navigate('/(main)/chat')}
                subtitle="Talk things through with a calm prompt-based space."
                title="Chat"
              />
              <PrimaryToolCard
                accentColor="#F59B73"
                ctaText="Start call"
                icon="call-outline"
                onPress={() => router.navigate('/(main)/call')}
                subtitle="Use voice when typing feels like too much."
                title="Voice"
              />
            </View>

            <View style={styles.secondaryToolsGrid}>
              <SecondaryToolCard
                accentColor="#7E6BEF"
                actionText="View trends"
                icon="pulse-outline"
                onPress={() => router.navigate('/(main)/mood-history')}
                title="Mood history"
              />
              <SecondaryToolCard
                accentColor="#E58A63"
                actionText="Write freely"
                icon="book-outline"
                onPress={() => router.navigate('/(main)/journal')}
                title="Journal"
              />
              <SecondaryToolCard
                accentColor="#45A38A"
                actionText="Take a pause"
                icon="leaf-outline"
                onPress={() => router.navigate('/(main)/breathing')}
                title="Breathing"
              />
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick picks</Text>
              <Text style={styles.sectionCaption}>
                Short paths back into the moments that usually help.
              </Text>
            </View>

            <View style={styles.recentCard}>
              <LinearGradient
                colors={['rgba(186, 166, 255, 0)', 'rgba(186, 166, 255, 0.16)']}
                end={{ x: 0.5, y: 1 }}
                pointerEvents="none"
                start={{ x: 0.5, y: 0 }}
                style={styles.recentCardGlow}
              />

              <View style={styles.quickPicksGrid}>
                {RECENT_ACTIVITY_ITEMS.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => handleRecentPress(item.id)}
                    style={[styles.quickPickItem, { backgroundColor: item.accentColor }]}
                  >
                    <View style={styles.quickPickTopRow}>
                      <View style={styles.quickPickBadge}>
                        <Ionicons name={item.icon} size={14} color={item.textColor} />
                      </View>
                      <Text style={[styles.quickPickTimestamp, { color: item.textColor }]}>
                        {item.timestamp}
                      </Text>
                    </View>
                    <View style={styles.quickPickTextBlock}>
                      <Text style={[styles.quickPickTitle, { color: item.textColor }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.quickPickSubtitle, { color: item.textColor }]}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </AnimatedScrollView>
      </FadingScrollWrapper>

      <Modal animationType="none" transparent visible={showZoomModal}>
        <TouchableWithoutFeedback onPress={closeZoomModal}>
          <View style={styles.zoomModalContainer}>
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.blurBackdrop, backdropAnimatedStyle]}
            >
              <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
            </Animated.View>

            <Animated.View
              style={[styles.zoomedAvatarContainer, zoomedAvatarAnimatedStyle]}
            >
              {avatar.type === 'emoji' && avatar.value ? (
                <Text style={styles.zoomedAvatarEmoji}>{avatar.value}</Text>
              ) : null}

              {avatar.type === 'image' && avatar.value ? (
                <Image source={{ uri: avatar.value }} style={styles.zoomedAvatarImage} />
              ) : null}
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    marginBottom: 8,
  },

  headerContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingVertical: 8,
  },

  logoText: {
    color: LIGHT_THEME.textPrimary,
    fontFamily: 'Playwrite',
    fontSize: 32,
  },

  profileButton: {
    padding: 4,
  },

  profileAvatar: {
    alignItems: 'center',
    backgroundColor: LIGHT_THEME.surface,
    borderColor: 'rgba(232, 230, 240, 0.95)',
    borderRadius: 20,
    borderWidth: 2,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 40,
    ...CARD_SHADOW_LIGHT,
  },

  avatarEmoji: {
    fontSize: 22,
  },

  avatarImage: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },

  scrollContent: {
    gap: 16,
    paddingHorizontal: 14,
  },

  heroCard: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: 28,
    borderWidth: 0,
    gap: 12,
    overflow: 'hidden',
    padding: 14,
    position: 'relative',
  },

  heroCardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    opacity: 1,
  },

  heroTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  heroTextBlock: {
    flex: 1,
    gap: 6,
  },

  eyebrow: {
    color: LIGHT_THEME.textMuted,
    fontFamily: 'Outfit-Medium',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  heroTitle: {
    color: LIGHT_THEME.textPrimary,
    fontFamily: 'Outfit-SemiBold',
    fontSize: 28,
  },

  heroSubtitle: {
    color: LIGHT_THEME.textSecondary,
    fontFamily: 'Outfit-Regular',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '92%',
  },

  heroPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderColor: 'rgba(232, 230, 240, 0.9)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  heroPillText: {
    color: LIGHT_THEME.textPrimary,
    fontFamily: 'Outfit-Medium',
    fontSize: 12,
  },

  focusPanel: {
    backgroundColor: 'rgba(248, 246, 255, 0.95)',
    borderRadius: 22,
    gap: 6,
    padding: 16,
  },

  focusLabel: {
    color: LIGHT_THEME.textMuted,
    fontFamily: 'Outfit-Medium',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  focusText: {
    color: LIGHT_THEME.textPrimary,
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    lineHeight: 23,
  },

  heroActions: {
    flexDirection: 'row',
  },

  heroActionButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 22,
  },

  heroActionSecondary: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: 'rgba(232, 230, 240, 0.9)',
    borderWidth: 1,
  },

  heroActionSecondaryText: {
    color: LIGHT_THEME.textPrimary,
    fontFamily: 'Outfit-SemiBold',
    fontSize: 15,
  },

  sectionBlock: {
    gap: 8,
  },

  sectionHeader: {
    gap: 4,
    paddingHorizontal: 2,
  },

  sectionTitle: {
    color: LIGHT_THEME.textPrimary,
    fontFamily: 'Outfit-SemiBold',
    fontSize: 20,
  },

  sectionCaption: {
    color: LIGHT_THEME.textSecondary,
    fontFamily: 'Outfit-Regular',
    fontSize: 14,
    lineHeight: 20,
  },

  primaryToolsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  secondaryToolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },

  recentCard: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: 24,
    borderWidth: 0,
    overflow: 'hidden',
    padding: 14,
    position: 'relative',
  },

  recentCardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    opacity: 1,
  },

  quickPicksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  quickPickItem: {
    borderRadius: 18,
    minHeight: 130,
    padding: 14,
    width: '48%',
  },

  quickPickTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  quickPickBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },

  quickPickTimestamp: {
    fontFamily: 'Outfit-Medium',
    fontSize: 11,
    opacity: 0.75,
  },

  quickPickTextBlock: {
    gap: 5,
    marginTop: 20,
  },

  quickPickTitle: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 15,
    lineHeight: 20,
  },

  quickPickSubtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.82,
  },

  zoomModalContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },

  blurBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },

  zoomedAvatarContainer: {
    alignItems: 'center',
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: ZOOMED_AVATAR_SIZE / 2,
    height: ZOOMED_AVATAR_SIZE,
    justifyContent: 'center',
    width: ZOOMED_AVATAR_SIZE,
  },

  zoomedAvatarEmoji: {
    fontSize: ZOOMED_AVATAR_SIZE * 0.6,
  },

  zoomedAvatarImage: {
    borderRadius: ZOOMED_AVATAR_SIZE / 2,
    height: ZOOMED_AVATAR_SIZE,
    width: ZOOMED_AVATAR_SIZE,
  },
});
