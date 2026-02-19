/**
 * Main App Tab Layout
 * Two-section design: rounded content card + dark tab bar surface
 *
 * Structure:
 *   ┌─────────────────────────┐
 *   │                         │
 *   │   Content Card          │  ← flex:1, rounded bottom corners
 *   │   (Tabs scenes)         │     overflow: hidden clips content
 *   │                         │
 *   └────╮               ╭───┘  ← borderBottomRadius visible
 *   ┌────┴───────────────┴───┐
 *   │       NAVBAR            │  ← flat dark surface
 *   └────────────────────────┘
 *
 *   Root background: #0D0D0D (dark) shows through rounded corners
 */

import { View, StyleSheet } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import FloatingTabBar from '@/components/home/FloatingTabBar';

const CONTENT_RADIUS = 28;
const FULL_SCREEN_ROUTES = new Set(['/breathing']);

export default function MainLayout() {
  const pathname = usePathname();
  const isFullScreen = FULL_SCREEN_ROUTES.has(pathname);

  return (
    <View style={styles.root}>
      {/* Section 1 — Content card with rounded bottom corners */}
      <View
        style={[
          styles.contentCard,
          isFullScreen && styles.contentCardFull,
        ]}
      >
        <Tabs
          tabBar={() => null}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen name="home" options={{ title: 'Home' }} />
          <Tabs.Screen name="call" options={{ title: 'Call' }} />
          <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings' }} />

          {/* Hidden — navigable via router but not in tab bar */}
          <Tabs.Screen name="mood" options={{ href: null }} />
          <Tabs.Screen name="profile" options={{ href: null }} />
          <Tabs.Screen name="mood-history" options={{ href: null }} />
          <Tabs.Screen name="journal" options={{ href: null }} />
          <Tabs.Screen name="breathing" options={{ href: null }} />
        </Tabs>
      </View>

      {/* Section 2 — Navbar (flat dark surface) */}
      {!isFullScreen && <FloatingTabBar />}
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
    borderBottomLeftRadius: CONTENT_RADIUS,
    borderBottomRightRadius: CONTENT_RADIUS,
    overflow: 'hidden',
  },
  contentCardFull: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
});
