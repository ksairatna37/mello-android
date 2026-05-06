/**
 * SelfMindTabBar — bottom navigation for the main app.
 *
 * 1:1 port of MBTabBar in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-shared.jsx
 * with the matching styling from .mb-tabbar in mobile-styles.css.
 *
 * Floating pill at the bottom (left/right inset 14, bottom 28). Backdrop
 * blur via expo-blur — falls back to a high-alpha cream surface where
 * blur isn't supported. Four tabs: HOME · VOICE · CHAT · PROFILE. Active
 * tab marked by ink-colored glyph + label and a small coral dot below.
 *
 * Tab routes:
 *   HOME    → /home
 *   VOICE   → /call    (the call screen IS the voice surface in this build)
 *   CHAT    → /chat
 *   PROFILE → /profile
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import { Glyphs, BRAND as C, RADIUS, SHADOW } from '@/components/common/BrandGlyphs';
import { recordRouteUse } from '@/services/home/featureUsageService';

type TabId = 'home' | 'voice' | 'chat' | 'profile';

const TABS: ReadonlyArray<{
  id: TabId;
  label: string;
  route: string;
  G: React.FC<{ size?: number; color?: string }>;
}> = [
  { id: 'home',    label: 'HOME',    route: '/home',    G: Glyphs.Home },
  // VOICE → /call which renders SelfMindVoicePre. Tapping "Start voice"
  // there pushes to /voice-active for the actual session.
  { id: 'voice',   label: 'VOICE',   route: '/call',    G: Glyphs.Mic },
  // CHAT → /chats (the thread index, SelfMindChatHome). Tapping a
  // thread there navigates to /chat (the conversation surface).
  { id: 'chat',    label: 'CHAT',    route: '/chats',   G: Glyphs.Chat },
  { id: 'profile', label: 'PROFILE', route: '/profile', G: Glyphs.Profile },
];

function pathToTab(pathname: string): TabId | null {
  // VOICE owns /call AND /voice-active (active session screen).
  if (pathname.startsWith('/voice-active') || pathname.startsWith('/call')) return 'voice';
  // CHAT owns BOTH the thread index (/chats) and the conversation
  // surface (/chat). startsWith('/chat') matches both, with /chats
  // checked first so it wins by short-circuit.
  if (pathname.startsWith('/chats') || pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/home')) return 'home';
  // Sub-routes that aren't one of the four primary tabs (e.g. /spaces,
  // /space, /journal, /grounding, etc.) → no tab is active. Returning
  // 'home' here would falsely highlight HOME on /spaces AND, worse,
  // cause the click handler's `if (!isActive)` guard to suppress
  // tapping HOME — leaving the user stuck on /spaces with no obvious
  // way back to /home.
  return null;
}

export default function SelfMindTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const active = pathToTab(pathname);

  // Bottom offset matches the design's `bottom: 28px` while still
  // respecting the device safe-area inset on tall iPhones.
  const bottomOffset = Math.max(28, insets.bottom + 8);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: bottomOffset }]}
    >
      <BlurView
        intensity={28}
        tint="light"
        style={styles.pill}
      >
        {/* Translucent overlay tints the blur toward cream — matches the
            design's rgba(255,255,255,0.85) over the backdrop. */}
        <View style={styles.tint} pointerEvents="none" />
        <View style={styles.row}>
          {TABS.map((t) => {
            const isActive = active === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.tab}
                onPress={() => {
                  if (!isActive) {
                    void recordRouteUse(t.route);
                    router.push(t.route as any);
                  }
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <t.G size={19} color={isActive ? C.ink : C.ink3} />
                <Text style={[styles.label, isActive && styles.labelActive]}>
                  {t.label}
                </Text>
                <View style={styles.dotSlot}>
                  {isActive && (
                    <Svg width={6} height={6} viewBox="0 0 6 6">
                      <Circle cx={3} cy={3} r={3} fill={C.coral} />
                    </Svg>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    // bottom set inline to incorporate safe-area inset
  },
  pill: {
    borderRadius: RADIUS.tabbar,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.line,
    ...SHADOW.tabbar,
    // Fallback color in case the blur layer renders flat (e.g. older
    // Android). 0.85 alpha matches the design's rgba(255,255,255,0.85).
    backgroundColor:
      Platform.OS === 'android'
        ? 'rgba(255,255,255,0.92)'
        : 'rgba(255,255,255,0.6)',
  },
  // Sits inside the BlurView and gives it a cream-leaning tint so the
  // backdrop reads as paper, not glass.
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  label: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    letterSpacing: 0.5,
    color: C.ink3,
    marginTop: 2,
  },
  labelActive: { color: C.ink },
  dotSlot: {
    width: 6,
    height: 6,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
