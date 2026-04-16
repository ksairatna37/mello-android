/**
 * HomeScreen - Redesigned with clean structure, reference-inspired layout
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
  Easing,
  Extrapolate,
  FadeIn,
  FadeInDown,
  LinearTransition,
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
import { sidebarStore } from '@/utils/sidebarStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ZOOMED_AVATAR_SIZE = SCREEN_WIDTH * 0.6;
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const TODAY_FOCUS = [
  'Notice one thing that feels lighter than yesterday.',
  'You do not need to solve everything today, just stay with yourself kindly.',
  'A small check-in still counts as care.',
];

const SUGGESTED_ACTIVITIES = [
  {
    id: 'yoga',
    icon: 'body-outline' as const,
    emoji: '🧘',
    label: 'Yoga',
    sublabel: 'Calm · Meditate',
    duration: '10 min',
    level: 'Beginner',
    accentColor: '#DDD4FF',
    iconColor: '#6F5DC5',
    pillColor: '#EEE9FF',
    artColor: '#F4F0FF',
  },
  {
    id: 'meditation',
    icon: 'flower-outline' as const,
    emoji: '🌸',
    label: 'Meditation',
    sublabel: 'Breathe · Meditate',
    duration: '5 min',
    level: 'Fundamental',
    accentColor: '#CDBCFF',
    iconColor: '#604DB8',
    pillColor: '#E5DDFF',
    artColor: '#F0EAFF',
  },
  {
    id: 'breathing',
    icon: 'leaf-outline' as const,
    emoji: '🍃',
    label: 'Mindfulness Yoga',
    sublabel: 'Breathe · Meditate',
    duration: '3 min',
    level: 'Fundamental',
    accentColor: '#B9A6FF',
    iconColor: '#4F3B9B',
    pillColor: '#D8CDFF',
    artColor: '#E8E1FF',
  },
];

const ACTIVITY_STACK_TRANSITION = LinearTransition
  .duration(280)
  .easing(Easing.out(Easing.cubic));

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
  const [activeActivity, setActiveActivity] = useState<string>('breathing');

  const zoomScale = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  const paddingTop = insets.top + 12;
  const subtitleH = useSharedValue(16);
  const subtitleOpacity = useSharedValue(1);
  const headerSubtitleText = 'Home';

  const subtitleAnimStyle = useAnimatedStyle(() => ({
    height: subtitleH.value,
    opacity: subtitleOpacity.value,
    overflow: 'hidden',
  }));

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

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 60], [1, 0.92], Extrapolate.CLAMP);
    return { opacity };
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

  const orderedActivities = [
    ...SUGGESTED_ACTIVITIES.filter((activity) => activity.id !== activeActivity),
    ...SUGGESTED_ACTIVITIES.filter((activity) => activity.id === activeActivity),
  ];

  const handleActivityPress = useCallback((id: string) => {
    setActiveActivity(id);
  }, []);

  const handleActivityPlay = useCallback((id: string) => {
    setActiveActivity(id);
    if (id === 'yoga' || id === 'meditation' || id === 'breathing') {
      router.navigate('/(main)/breathing');
    }
  }, [router]);

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
            { paddingTop: insets.top + 8, paddingBottom: 88 + insets.bottom },
          ]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={[styles.header]}>
            <View style={styles.headerCenter}>
              <Text style={styles.logoText}>mello</Text>
              <Animated.View style={subtitleAnimStyle}>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {headerSubtitleText}
                </Text>
              </Animated.View>
            </View>
          </View>

          {/* ── DAILY CHECK IN ── */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Daily mood check</Text>
              {checkInComplete && (
                <View style={styles.doneBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                  <Text style={styles.doneBadgeText}>Done</Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionCaption}>
              {checkInComplete
                ? 'Nice work. You showed up for yourself.'
                : 'How are you feeling today? Take a moment to check in with yourself.'}
            </Text>
            <DailyCheckInCard onCheckInComplete={() => setCheckInComplete(true)} />
          </Animated.View>

          {/* ── SUGGESTED ACTIVITIES ── */}
          <Animated.View entering={FadeInDown.duration(400).delay(160)} style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Suggested activities</Text>
              <Pressable onPress={() => router.navigate('/(main)/breathing')}>
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            </View>

            <View style={styles.activityList}>
              {orderedActivities.map((activity, index) => {
                const isActive = activity.id === activeActivity;

                return (
                  <Animated.View
                    key={activity.id}
                    layout={ACTIVITY_STACK_TRANSITION}
                    style={[
                      styles.activityCardWrap,
                      index !== 0 && styles.activityCardOverlap,
                      { zIndex: index + 1 },
                    ]}
                  >
                    <Pressable
                      onPress={() => handleActivityPress(activity.id)}
                      style={({ pressed }) => [
                        styles.activityCard,
                        isActive ? styles.activityCardActive : styles.activityCardInactive,
                        { backgroundColor: activity.accentColor },
                        pressed && styles.activityCardPressed,
                      ]}
                    >
                      {/* LEFT: text only — no icon */}
                      <View style={styles.activityLeft}>
                        <View style={styles.activityTextBlock}>
                          <Text style={styles.activityLabel}>{activity.label}</Text>
                          <Text style={styles.activitySublabel}>{activity.sublabel}</Text>
                        </View>

                        {isActive && (
                          <View style={styles.activityMeta}>
                            <View style={styles.activityMetaItem}>
                              <Ionicons name="time-outline" size={13} color="#54468E" />
                              <Text style={styles.activityMetaText}>{activity.duration}</Text>
                            </View>
                            <View style={styles.activityMetaItem}>
                              <Ionicons name="barbell-outline" size={13} color="#54468E" />
                              <Text style={styles.activityMetaText}>{activity.level}</Text>
                            </View>
                          </View>
                        )}
                      </View>

                      {/* RIGHT: artwork block with play button pinned to its top-right */}
                      <View
                        style={[
                          styles.activityArtwork,
                          isActive ? styles.activityArtworkActive : styles.activityArtworkInactive,
                          { backgroundColor: activity.artColor },
                        ]}
                      >
                        <Ionicons
                          name={activity.icon}
                          size={isActive ? 42 : 24}
                          color={activity.iconColor}
                        />

                        {/* Play button absolutely positioned inside artwork, top-right */}
                        <Pressable
                          hitSlop={8}
                          onPress={(event) => {
                            event.stopPropagation?.();
                            handleActivityPlay(activity.id);
                          }}
                          style={({ pressed }) => [
                            styles.activityPlayButton,
                            isActive && styles.activityPlayButtonActive,
                            pressed && styles.activityPlayButtonPressed,
                          ]}
                        >
                          <Ionicons name="play" size={isActive ? 14 : 12} color={activity.iconColor} />
                        </Pressable>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          {/* ── QUICK CONNECT ── */}
          {/* <Animated.View entering={FadeInDown.duration(400).delay(210)} style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Talk to Mello</Text>
            </View>
            <Text style={styles.sectionCaption}>Choose how you want to connect today.</Text>

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
          </Animated.View> */}

          {/* ── QUICK PICKS ── */}
          <Animated.View entering={FadeInDown.duration(400).delay(260)} style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Quick picks</Text>
            </View>
            <Text style={styles.sectionCaption}>
              Short paths back into the moments that usually help.
            </Text>

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
          </Animated.View>

          {/* ── MOOD HISTORY CARD ── */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)}>
            <Pressable
              onPress={() => router.navigate('/(main)/mood-history')}
              style={({ pressed }) => [styles.moodHistoryCard, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={['#EDE9FE', '#FEF3C7']}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.moodHistoryContent}>
                <View>
                  <Text style={styles.moodHistoryTitle}>Your mood pattern</Text>
                  <Text style={styles.moodHistorySubtitle}>See your weekly rhythm → Last 7 days</Text>
                </View>
                <View style={styles.moodHistoryIcon}>
                  <Ionicons name="analytics-outline" size={28} color="#7C3AED" />
                </View>
              </View>
            </Pressable>
          </Animated.View>

        </AnimatedScrollView>
      </FadingScrollWrapper>

      {/* ── ZOOM AVATAR MODAL ── */}
      <Modal animationType="none" transparent visible={showZoomModal}>
        <TouchableWithoutFeedback onPress={closeZoomModal}>
          <View style={styles.zoomModalContainer}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.blurBackdrop, backdropAnimatedStyle]}>
              <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
            </Animated.View>
            <Animated.View style={[styles.zoomedAvatarContainer, zoomedAvatarAnimatedStyle]}>
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

  scrollContent: {
    gap: 20,
    paddingHorizontal: 16,
  },

  // ── HEADER ──
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  logoText: {
    fontFamily: 'Playwrite',
    fontSize: 26,
    color: '#1A1A1A',
    lineHeight: 32,
    marginBottom: 10,
  },

  headerSubtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    marginTop: 1,
  },

  profileAvatar: {
    alignItems: 'center',
    backgroundColor: LIGHT_THEME.surface,
    borderColor: 'rgba(232, 230, 240, 0.95)',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
    ...CARD_SHADOW_LIGHT,
  },

  avatarEmoji: {
    fontSize: 24,
  },

  avatarImage: {
    borderRadius: 24,
    height: 48,
    width: 48,
  },

  greetingText: {
    color: LIGHT_THEME.textPrimary,
    fontFamily: 'Outfit-SemiBold',
    fontSize: 18,
  },

  subGreeting: {
    color: LIGHT_THEME.textMuted,
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    marginTop: 1,
  },

  settingsButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderColor: 'rgba(232, 230, 240, 0.9)',
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
    ...CARD_SHADOW_LIGHT,
  },

  // ── SECTION ──
  sectionBlock: {
    gap: 10,
  },

  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    color: LIGHT_THEME.textPrimary,
    fontFamily: 'Outfit-SemiBold',
    fontSize: 18,
  },

  sectionCaption: {
    color: LIGHT_THEME.textSecondary,
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: -4,
  },

  seeAllText: {
    color: '#7C3AED',
    fontFamily: 'Outfit-Medium',
    fontSize: 13,
  },

  doneBadge: {
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  doneBadgeText: {
    color: '#16A34A',
    fontFamily: 'Outfit-SemiBold',
    fontSize: 12,
  },

  // ── ACTIVITIES ──
  activityList: {
    paddingTop: 4,
  },

  activityCardWrap: {
    position: 'relative',
  },

  activityCardOverlap: {
    marginTop: -50,
  },

  activityCard: {
    alignItems: 'stretch',
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: 14,
    ...CARD_SHADOW_LIGHT,
  },

  activityCardActive: {
    borderRadius: 28,
    minHeight: 182,
    paddingBottom: 16,
  },

  activityCardInactive: {
    borderRadius: 24,
    minHeight: 94,
    paddingVertical: 12,
  },

  activityCardPressed: {
    opacity: 0.95,
  },

  // LEFT side — text only, no icon
  activityLeft: {
    flex: 1,
    justifyContent: 'space-between',
    paddingRight: 12,
  },

  activityTextBlock: {
    gap: 3,
  },

  activityLabel: {
    color: LIGHT_THEME.textPrimary,
    fontFamily: 'Outfit-SemiBold',
    fontSize: 16,
  },

  activitySublabel: {
    color: 'rgba(36, 28, 68, 0.7)',
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
  },

  // Meta stacked vertically (column direction)
  activityMeta: {
    flexDirection: 'column',
    gap: 6,
    marginTop: 14,
  },

  activityMetaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },

  activityMetaText: {
    color: '#54468E',
    fontFamily: 'Outfit-Medium',
    fontSize: 12,
  },

  // RIGHT side — artwork block, play button lives inside it
  activityArtwork: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative', // required so play button can be absolute inside
  },

  activityArtworkActive: {
    alignSelf: 'flex-end',
    borderRadius: 26,
    height: 132,
    width: 132,
  },

  activityArtworkInactive: {
    alignSelf: 'center',
    borderRadius: 20,
    height: 68,
    width: 88,
  },

  // Play button — absolutely positioned at top-right of artwork block
  activityPlayButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 22,
    borderColor: 'rgba(79, 59, 155, 0.14)',
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },

  activityPlayButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    height: 38,
    width: 38,
  },

  activityPlayButtonPressed: {
    opacity: 0.86,
  },

  // ── TOOLS ──
  primaryToolsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // ── QUICK PICKS ──
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

  // ── MOOD HISTORY CARD ──
  moodHistoryCard: {
    borderRadius: 22,
    overflow: 'hidden',
    ...CARD_SHADOW_LIGHT,
  },

  moodHistoryContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },

  moodHistoryTitle: {
    color: LIGHT_THEME.textPrimary,
    fontFamily: 'Outfit-SemiBold',
    fontSize: 17,
  },

  moodHistorySubtitle: {
    color: LIGHT_THEME.textSecondary,
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    marginTop: 3,
  },

  moodHistoryIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },

  // ── ZOOM MODAL ──
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