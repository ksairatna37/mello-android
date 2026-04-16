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
import FloatingTabBar from '@/components/home/FloatingTabBar';
import { fullscreenStore } from '@/utils/fullscreenStore';
import { sidebarStore } from '@/utils/sidebarStore';
import { chatNavStore } from '@/utils/chatNavStore';
import ChatSidebar from '@/components/chat/ChatSidebar';
import type { ChatListItem } from '@/services/chat/chatService';

const CONTENT_RADIUS = 28;
const FULL_SCREEN_ROUTES = new Set(['/breathing']);
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
          <Tabs.Screen name="home" options={{ title: 'Home' }} />
          <Tabs.Screen name="call" options={{ title: 'Call' }} />
          <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings' }} />

          {/* Hidden — navigable via router but not in tab bar */}
          <Tabs.Screen name="chats" options={{ href: null }} />
          <Tabs.Screen name="mood" options={{ href: null }} />
          <Tabs.Screen name="profile" options={{ href: null }} />
          <Tabs.Screen name="mood-history" options={{ href: null }} />
          <Tabs.Screen name="journal" options={{ href: null }} />
          <Tabs.Screen name="breathing" options={{ href: null }} />
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
          <FloatingTabBar />
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
