/**
 * HomeScreen Component - Swipeable Pages
 * Horizontal pager with 4 sections:
 * - My Vibes (mood check-in)
 * - Love Notes (journal)
 * - Mood Tides (mood history)
 * - Gentle Support (crisis resources)
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Pressable,
  Image,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAvatar } from '@/utils/onboardingStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ZOOMED_AVATAR_SIZE = SCREEN_WIDTH * 0.6;

import { LIGHT_THEME } from '@/components/common/LightGradient';
import ThemedAuroraGradient, { AuroraThemeName } from '@/components/common/ThemedAuroraGradient';
import DreamyGradient from '@/components/common/DreamyGradient';
import HorizontalPager, { HorizontalPagerRef } from '@/components/common/HorizontalPager';
import HomeTabSelector, { TabItem } from '@/components/home/HomeTabSelector';

// Page Components
import {
  MyVibesPage,
  LoveNotesPage,
  MoodTidesPage,
  GentleSupportPage,
} from '@/components/home/pages';

// ═══════════════════════════════════════════════════════════════════
// THEME CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
// Aurora Dark:  'warmPink' | 'deepPurple' | 'coolTeal' | 'softLavender' | 'deepIndigo' | 'darkEmerald'
// Aurora Light: 'softCream' | 'roseDawn' | 'oceanMist'
// Special:      'dreamy' (animated floating clouds)
type GradientTheme = AuroraThemeName | 'dreamy';
const CURRENT_THEME: GradientTheme = 'lavenderMist';
const LIGHT_THEMES: GradientTheme[] = ['softCream', 'roseDawn', 'oceanMist', 'lavenderMist', 'dreamy'];

// ═══════════════════════════════════════════════════════════════════
// TAB CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
const HOME_TABS: TabItem[] = [
  { id: 'vibes', label: 'My Vibes', icon: 'sunny-outline' },
  { id: 'journal', label: 'Positive Notes', icon: 'heart-outline' },
  { id: 'mood', label: 'Mood Tides', icon: 'analytics-outline' },
  { id: 'support', label: 'Gentle Support', icon: 'hand-left-outline' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pagerRef = useRef<HorizontalPagerRef>(null);

  // Avatar state
  const [avatar, setAvatar] = useState<{ type: string | null; value: string | null }>({
    type: null,
    value: null,
  });

  // Avatar zoom modal state
  const [showZoomModal, setShowZoomModal] = useState(false);
  const zoomScale = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    const loadAvatar = async () => {
      const avatarData = await getAvatar();
      setAvatar(avatarData);
    };
    loadAvatar();
  }, []);

  // Avatar zoom handlers
  const openZoomModal = useCallback(() => {
    if (!avatar.value) return;
    setShowZoomModal(true);
    backdropOpacity.value = withTiming(1, { duration: 250 });
    zoomScale.value = withTiming(1, {
      duration: 250,
      easing: Easing.out(Easing.ease),
    });
  }, [avatar.value, backdropOpacity, zoomScale]);

  const closeZoomModal = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    zoomScale.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.ease),
    }, () => {
      runOnJS(setShowZoomModal)(false);
    });
  }, [backdropOpacity, zoomScale]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const zoomedAvatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }],
  }));

  // Shared animated value for tab indicator sync
  const animatedPageIndex = useSharedValue(0);

  // Handle tab press - scroll pager to page
  const handleTabPress = useCallback((index: number) => {
    pagerRef.current?.scrollToPage(index);
  }, []);

  // Handle page change from swipe
  const handlePageChange = useCallback((index: number) => {
    // Page changed via swipe - tab selector updates automatically via animatedPageIndex
  }, []);

  return (
    <View style={styles.container}>
      {/* StatusBar */}
      <StatusBar
        barStyle={LIGHT_THEMES.includes(CURRENT_THEME) ? 'dark-content' : 'light-content'}
      />

      {/* Gradient Background */}
      {CURRENT_THEME === 'dreamy' ? (
        <DreamyGradient />
      ) : (
        <ThemedAuroraGradient theme={CURRENT_THEME as AuroraThemeName} />
      )}

      {/* Header - Fixed at top */}
      <Animated.View
        style={[styles.header, { paddingTop: insets.top + 12 }]}
        entering={FadeIn.duration(400)}
      >
        {/* Logo / Status */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>mello</Text>
        </View>

        {/* Profile Button - Tap to zoom, long-press to settings */}
        <Pressable
          style={styles.profileButton}
          onPress={openZoomModal}
          onLongPress={() => router.navigate('/(main)/settings')}
        >
          <View style={styles.profileAvatar}>
            {avatar.type === 'emoji' && avatar.value ? (
              <Text style={styles.avatarEmoji}>{avatar.value}</Text>
            ) : avatar.type === 'image' && avatar.value ? (
              <Image source={{ uri: avatar.value }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={16} color={LIGHT_THEME.textSecondary} />
            )}
          </View>
        </Pressable>
      </Animated.View>

      {/* Tab Selector - Synced with pager */}
      <View style={styles.tabSection}>
        <HomeTabSelector
          tabs={HOME_TABS}
          animatedIndex={animatedPageIndex}
          onTabPress={handleTabPress}
        />
      </View>

      {/* Horizontal Pager */}
      <HorizontalPager
        ref={pagerRef}
        pages={[
          <MyVibesPage key="vibes" />,
          <LoveNotesPage key="journal" />,
          <MoodTidesPage key="mood" />,
          <GentleSupportPage key="support" />,
        ]}
        animatedIndex={animatedPageIndex}
        onPageChange={handlePageChange}
      />

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
                intensity={80}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <Animated.View style={[styles.zoomedAvatarContainer, zoomedAvatarAnimatedStyle]}>
              {avatar.type === 'emoji' && avatar.value && (
                <Text style={styles.zoomedAvatarEmoji}>{avatar.value}</Text>
              )}
              {avatar.type === 'image' && avatar.value && (
                <Image source={{ uri: avatar.value }} style={styles.zoomedAvatarImage} />
              )}
              {!avatar.value && (
                <Ionicons name="person" size={ZOOMED_AVATAR_SIZE * 0.5} color={LIGHT_THEME.textSecondary} />
              )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
    fontFamily: 'Playwrite',
    color: '#FFFFFF',
    letterSpacing: 0,
  },
  profileButton: {
    padding: 4,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIGHT_THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: LIGHT_THEME.border,
    overflow: 'hidden',
  },
  avatarEmoji: {
    fontSize: 22,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tabSection: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  // Zoom Modal styles
  zoomModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  zoomedAvatarContainer: {
    width: ZOOMED_AVATAR_SIZE,
    height: ZOOMED_AVATAR_SIZE,
    borderRadius: ZOOMED_AVATAR_SIZE / 2,
    backgroundColor: LIGHT_THEME.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
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
