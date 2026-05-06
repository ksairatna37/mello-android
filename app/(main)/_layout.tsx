/**
 * Main App Tab Layout
 * Two-section design: rounded content card + dark tab bar surface
 *
 * Fullscreen animation:
 *   - Content card gets marginBottom: -tabBarHeight (one-time layout change)
 *     making it extend underneath the tab bar area (z-order: tab bar on top)
 *   - Tab bar fades + slides down via GPU (opacity + translateY, 250ms)
 *   - As tab bar fades, content is revealed underneath — smooth reveal effect
 *   - Returning: tab bar fades in, covering the content extension, then
 *     marginBottom is removed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, usePathname, router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import SelfMindTabBar from '@/components/home/SelfMindTabBar';
import { fullscreenStore } from '@/utils/fullscreenStore';
import { sidebarStore } from '@/utils/sidebarStore';
import { chatNavStore } from '@/utils/chatNavStore';
import ChatSidebar from '@/components/chat/ChatSidebar';
import type { ChatListItem } from '@/services/chat/chatService';

const CONTENT_RADIUS = 28;
/**
 * Per the Claude design (mobile-screens-{a,b,c}.jsx), MBTabBar is only
 * mounted on: MBHome (/home), MBChatHome (/chats), MBPracticeLibrary
 * (/practice), MBJournalHome (/journal), MBProgress (/mood-history),
 * MBSettings (/profile). Every other surface is immersive — voice flow,
 * mid-chat, journal composer/entry, breath/ground/brain practices,
 * weekly, mood detail, chat archive, notifications.
 */
const FULL_SCREEN_ROUTES = new Set([
  '/breathing',
  '/chat',
  '/chat-history',
  '/call',
  '/voice-active',
  '/voice-summary',
  '/voice-limit',
  '/journal-entry',
  '/journal-prompt',
  '/mood-detail',
  '/practice',
  '/box-breath',
  '/box-breath-summary',
  '/box-breath-crisis-return',
  '/tell-someone',
  '/grounding',
  '/brain-dump',
  '/reach-out',
  '/weekly',
  '/notifications',
  '/space',
]);
const ANIM_DURATION = 250;
const ANIM_EASING = Easing.out(Easing.cubic);
const ANIM_CONFIG = { duration: ANIM_DURATION, easing: ANIM_EASING };

export default function MainLayout() {
  const pathname = usePathname();
  const isRouteFullScreen = FULL_SCREEN_ROUTES.has(pathname);
  const isExternalFullScreen = useSyncExternalStore(
    fullscreenStore.subscribe,
    fullscreenStore.getSnapshot,
  );
  const isFullScreen = isRouteFullScreen || isExternalFullScreen;

  // Sidebar state — subscribed here so one ChatSidebar instance serves all tabs
  const sidebar = useSyncExternalStore(sidebarStore.subscribe, sidebarStore.getSnapshot);

  const handleSidebarNewChat = useCallback(() => {
    sidebarStore.close();
    chatNavStore.push({ type: 'new-chat' });
    router.navigate('/chat');
  }, []);

  const handleSidebarSelectSession = useCallback((session: ChatListItem) => {
    sidebarStore.close();
    chatNavStore.push({ type: 'select-session', session });
    router.navigate('/chat');
  }, []);

  // Measure tab bar height once via onLayout
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const handleTabBarLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setTabBarHeight((prev) => (prev === h ? prev : h));
  }, []);

  // Skip animation on initial mount
  const prevFullScreenRef = useRef(isFullScreen);

  // GPU-only shared values
  const tabBarTranslateY = useSharedValue(0);
  const tabBarOpacity = useSharedValue(1);
  const contentRadius = useSharedValue(CONTENT_RADIUS);

  // GPU animation — tab bar slide + fade, border radius
  useEffect(() => {
    if (prevFullScreenRef.current === isFullScreen) return;
    prevFullScreenRef.current = isFullScreen;

    const H = tabBarHeight || 80;

    if (isFullScreen) {
      tabBarTranslateY.value = withTiming(H, ANIM_CONFIG);
      tabBarOpacity.value = withTiming(0, ANIM_CONFIG);
      contentRadius.value = withTiming(0, ANIM_CONFIG);
    } else {
      tabBarTranslateY.value = withTiming(0, ANIM_CONFIG);
      tabBarOpacity.value = withTiming(1, ANIM_CONFIG);
      contentRadius.value = withTiming(CONTENT_RADIUS, ANIM_CONFIG);
    }
  }, [isFullScreen]);

  const contentCardStyle = useAnimatedStyle(() => ({
    borderBottomLeftRadius: contentRadius.value,
    borderBottomRightRadius: contentRadius.value,
  }));

  const tabBarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarTranslateY.value }],
    opacity: tabBarOpacity.value,
  }));

  return (
    <View style={styles.root}>
      {/* Content card — when fullscreen, negative marginBottom makes it
          extend underneath the tab bar. Tab bar (later sibling) is on top
          via z-order, so the extension is hidden until tab bar fades out. */}
      <Animated.View
        style={[
          styles.contentCard,
          contentCardStyle,
          isFullScreen && tabBarHeight > 0 && { marginBottom: -tabBarHeight },
        ]}
      >
        <Tabs
          tabBar={() => null}
          screenOptions={{ headerShown: false }}
        >
          {/* SelfMind redesign tabs: HOME · VOICE · CHAT · PROFILE.
              The tab bar (`SelfMindTabBar`) renders its own labels and
              icons; the `title` here is just for accessibility / default
              navigator title.
                /call  — VOICE tab landing (renders SelfMindVoicePre)
                /chats — CHAT  tab landing (renders SelfMindChatHome) */}
          <Tabs.Screen name="home" options={{ title: 'Home' }} />
          <Tabs.Screen name="call" options={{ title: 'Voice' }} />
          <Tabs.Screen name="chats" options={{ title: 'Chat' }} />
          <Tabs.Screen name="profile" options={{ title: 'Profile' }} />

          {/* Hidden — navigable via router but not surfaced in the tab bar */}
          <Tabs.Screen name="chat" options={{ href: null }} />
          <Tabs.Screen name="chat-history" options={{ href: null }} />
          <Tabs.Screen name="notifications" options={{ href: null }} />
          <Tabs.Screen name="voice-active" options={{ href: null }} />
          <Tabs.Screen name="voice-summary" options={{ href: null }} />
          <Tabs.Screen name="voice-limit" options={{ href: null }} />
          <Tabs.Screen name="journal-entry" options={{ href: null }} />
          <Tabs.Screen name="journal-prompt" options={{ href: null }} />
          <Tabs.Screen name="mood-detail" options={{ href: null }} />
          <Tabs.Screen name="practice" options={{ href: null }} />
          <Tabs.Screen name="weekly" options={{ href: null }} />
          <Tabs.Screen name="box-breath" options={{ href: null }} />
          <Tabs.Screen name="box-breath-summary" options={{ href: null }} />
          <Tabs.Screen name="box-breath-crisis-return" options={{ href: null }} />
          <Tabs.Screen name="tell-someone" options={{ href: null }} />
          <Tabs.Screen name="reach-out" options={{ href: null }} />
          <Tabs.Screen name="grounding" options={{ href: null }} />
          <Tabs.Screen name="brain-dump" options={{ href: null }} />
          <Tabs.Screen name="mood" options={{ href: null }} />
          <Tabs.Screen name="settings" options={{ href: null }} />
          <Tabs.Screen name="mood-history" options={{ href: null }} />
          <Tabs.Screen name="journal" options={{ href: null }} />
          <Tabs.Screen name="breathing" options={{ href: null }} />
          <Tabs.Screen name="spaces" options={{ href: null }} />
          <Tabs.Screen name="space" options={{ href: null }} />
        </Tabs>

        {/* Sidebar — absolute overlay inside contentCard so the tab bar
            (later sibling) naturally sits on top, same z-order as before. */}
        <ChatSidebar
          visible={sidebar.isOpen}
          currentSessionId={sidebar.currentSessionId}
          currentTitle={sidebar.currentTitle}
          userEmail={sidebar.userEmail}
          onClose={sidebarStore.close}
          onNewChat={handleSidebarNewChat}
          onSelectSession={handleSidebarSelectSession}
        />
      </Animated.View>

      {/* Tab bar — always in layout, GPU-only animation.
          Z-order: on top of content card (later sibling).
          pointerEvents: 'none' when hidden to prevent ghost taps. */}
      <View onLayout={handleTabBarLayout}>
        <Animated.View
          style={tabBarAnimStyle}
          pointerEvents={isFullScreen ? 'none' : 'auto'}
        >
          <SelfMindTabBar />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  contentCard: {
    flex: 1,
    overflow: 'hidden',
  },
});
