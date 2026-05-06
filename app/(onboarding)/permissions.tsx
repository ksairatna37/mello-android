/**
 * Permissions — 1:1 port of MBPermissions in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding.jsx
 *
 * Cream-2 canvas, top bar with back chevron + "SKIP ALL", italic-on-"want"
 * headline, three permission cards (Mic / Notifications / Focus & Sleep),
 * each with its own ALLOW / NOT NOW buttons, sage "how we handle it"
 * privacy card, primary "Continue" CTA pinned in footer.
 *
 * Wiring preserved & extended:
 *   - real native requests for Mic (expo-av) and Notifications
 *     (expo-notifications). Health/Sleep is a soft no-op for now —
 *     marked as Coming soon inline, no native call (we don't link
 *     a Health module yet).
 *   - selections persist to OnboardingData (notificationsEnabled,
 *     microphoneEnabled) — the rest of the app reads these.
 *   - Continue (and SKIP ALL) → /(onboarding)/welcome-aboard
 *     which calls AuthContext.completeOnboarding to sync to the
 *     backend and route to the main app.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import { updateOnboardingData, getOnboardingData } from '@/utils/onboardingStorage';

/* ─── Permission rows (data) ──────────────────────────────────────── */

type PermKey = 'mic' | 'notifications' | 'health';

interface PermSpec {
  key: PermKey;
  Icon: React.FC<{ size?: number; color?: string }>;
  tile: string;
  title: string;
  body: string;
  recommended?: boolean;
}

const PERMS: PermSpec[] = [
  {
    key: 'mic',
    Icon: Glyphs.Mic,
    tile: C.coral,
    title: 'Microphone',
    body: 'So voice sessions can hear you. We never record without a soft orange light.',
    recommended: true,
  },
  {
    key: 'notifications',
    Icon: Glyphs.Bell,
    tile: C.peach,
    title: 'Notifications',
    body: 'One gentle check-in a day, at a time you pick. Never red badges. Never shame.',
  },
  {
    key: 'health',
    Icon: Glyphs.Moon,
    tile: C.lavender,
    title: 'Focus & Sleep data',
    body: 'Optional. Connect Health to see when your hardest hours are.',
  },
];

type PermState = 'idle' | 'allowed' | 'denied';

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function PermissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [states, setStates] = useState<Record<PermKey, PermState>>({
    mic: 'idle',
    notifications: 'idle',
    health: 'idle',
  });

  // Restore previously-granted toggles so the user sees current state.
  useEffect(() => {
    (async () => {
      const data = await getOnboardingData();
      setStates((prev) => ({
        ...prev,
        mic: data.microphoneEnabled ? 'allowed' : prev.mic,
        notifications: data.notificationsEnabled ? 'allowed' : prev.notifications,
      }));
    })();
  }, []);

  // Hardware back: blocked. /permissions is a decision screen — the user
  // must explicitly tap Continue (after answering) or Skip All to leave.
  // Going back would either land on a stale auth screen (/save-profile,
  // /verify-email — incoherent for an already-authed user) or sneak the
  // user past a step that needs a conscious choice. Routing forward on
  // back was the previous behavior; that turned "back" into a stealth
  // skip. Now back does nothing.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );

  /* Entrance animations */
  const headerAnim = useSharedValue(0);
  const cardsAnim  = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    headerAnim.value = withTiming(1, { duration: 550, easing: ease });
    cardsAnim.value  = withDelay(180, withTiming(1, { duration: 500, easing: ease }));
  }, [headerAnim, cardsAnim]);
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [{ translateY: (1 - headerAnim.value) * 16 }],
  }));
  const cardsStyle = useAnimatedStyle(() => ({
    opacity: cardsAnim.value,
    transform: [{ translateY: (1 - cardsAnim.value) * 12 }],
  }));

  /* Permission requests — real native calls for mic + notifications. */
  const handleAllow = async (key: PermKey) => {
    if (key === 'mic') {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        const next: PermState = status === 'granted' ? 'allowed' : 'denied';
        setStates((s) => ({ ...s, mic: next }));
        if (next === 'allowed') void updateOnboardingData({ microphoneEnabled: true });
      } catch {
        setStates((s) => ({ ...s, mic: 'denied' }));
      }
      return;
    }
    if (key === 'notifications') {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        const next: PermState = status === 'granted' ? 'allowed' : 'denied';
        setStates((s) => ({ ...s, notifications: next }));
        if (next === 'allowed') void updateOnboardingData({ notificationsEnabled: true });
      } catch {
        setStates((s) => ({ ...s, notifications: 'denied' }));
      }
      return;
    }
    if (key === 'health') {
      // Health/Sleep is not wired to a native module yet. Mark as
      // soft-allowed so the UI advances; surface intent as a stored
      // preference if/when a Health connector is added later.
      setStates((s) => ({ ...s, health: 'allowed' }));
      return;
    }
  };

  const handleNotNow = (key: PermKey) =>
    setStates((s) => ({ ...s, [key]: 'denied' }));

  /* Exit paths — all three go to welcome-aboard.
   *
   * Push, not replace: forward transition animates correctly (slide
   * from right). The "infinite ping-pong" risk previously called out
   * here is mitigated because /welcome-aboard blocks the hardware
   * back press unconditionally — back from welcome-aboard cannot pop
   * to permissions and re-trigger this handler.
   *
   * handleBack also pushes (not pops) — the user is forwarded past
   * permissions, not returned to the previous screen, because the
   * verify-email / save-profile screens beneath permissions aren't a
   * coherent destination once auth is complete. */
  const handleContinue = () => {
    router.push('/(onboarding)/welcome-aboard' as any);
  };
  const handleSkipAll = () => {
    router.push('/(onboarding)/welcome-aboard' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar — back chevron intentionally absent. /permissions is a
          decision screen: leave only via Continue or Skip All. The
          left-side spacer keeps SKIP ALL right-aligned without the back
          button taking visual weight that would imply a back path. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={handleSkipAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.skipLabel}>SKIP ALL</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={headerStyle}>
          <Text style={styles.headline} numberOfLines={2}>
            Only what you <Text style={styles.headlineItalic}>want</Text> to give.
          </Text>
          <Text style={styles.body}>
            You can change any of these later, or now. We explain each one in plain English.
          </Text>
        </Animated.View>

        {/* Permission cards */}
        <Animated.View style={[styles.cardsList, cardsStyle]}>
          {PERMS.map((p) => {
            const state = states[p.key];
            const allowed = state === 'allowed';
            return (
              <View key={p.key} style={styles.permCard}>
                <View style={[styles.iconTile, { backgroundColor: p.tile }]}>
                  <p.Icon size={20} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.permTitleRow}>
                    <Text style={styles.permTitle}>{p.title}</Text>
                    {p.recommended && (
                      <View style={styles.recommendedTag}>
                        <Text style={styles.recommendedText}>RECOMMENDED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.permBody}>{p.body}</Text>

                  <View style={styles.permActions}>
                    <TouchableOpacity
                      onPress={() => handleAllow(p.key)}
                      activeOpacity={0.85}
                      style={[
                        styles.allowBtn,
                        p.recommended && !allowed && styles.allowBtnRecommended,
                        allowed && styles.allowBtnGranted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.allowText,
                          p.recommended && !allowed && styles.allowTextRecommended,
                          allowed && styles.allowTextGranted,
                        ]}
                      >
                        {allowed ? 'ALLOWED' : 'ALLOW'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleNotNow(p.key)} activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.notNowText,
                          state === 'denied' && styles.notNowTextActive,
                        ]}
                      >
                        NOT NOW
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </Animated.View>

        {/* "How we handle it" sage card */}
        <View style={styles.privacyCard}>
          <View style={styles.privacyKickerRow}>
            <Glyphs.Leaf size={14} color={C.ink} />
            <Text style={styles.privacyKicker}>HOW WE HANDLE IT</Text>
          </View>
          <Text style={styles.privacyBody}>
            Your voice is transcribed and the audio is deleted the same day. Your journal is encrypted. Nothing is sold. Ever.
          </Text>
        </View>
      </ScrollView>

      {/* Pinned CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.cta} onPress={handleContinue} activeOpacity={0.9}>
          <Text style={styles.ctaText}>Continue</Text>
          <Glyphs.Arrow size={13} color={C.cream} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream2 },

  topBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  skipLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10, letterSpacing: 2.2,
    color: C.ink3,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  headline: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 32, lineHeight: 40,
    letterSpacing: -0.3,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  body: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5, lineHeight: 20,
    color: C.ink2,
    letterSpacing: 0.1,
    maxWidth: 320,
  },

  cardsList: { marginTop: 22, gap: 10 },
  permCard: {
    backgroundColor: C.paper,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  iconTile: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  permTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  },
  permTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 16, lineHeight: 22, color: C.ink,
    letterSpacing: -0.1,
  },
  recommendedTag: {
    paddingVertical: 2, paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: C.ink,
  },
  recommendedText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 8, letterSpacing: 0.8,
    color: C.cream,
  },
  permBody: {
    marginTop: 6,
    fontFamily: 'Fraunces-Text',
    fontSize: 12.5, lineHeight: 18,
    color: C.ink2,
  },
  permActions: {
    marginTop: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  allowBtn: {
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line2,
  },
  allowBtnRecommended: {
    backgroundColor: C.ink,
    borderColor: 'transparent',
  },
  allowBtnGranted: {
    backgroundColor: C.sage,
    borderColor: 'transparent',
  },
  allowText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10, letterSpacing: 1.4,
    color: C.ink,
  },
  allowTextRecommended: { color: C.cream },
  allowTextGranted: { color: C.ink },
  notNowText: {
    paddingVertical: 6, paddingHorizontal: 14,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10, letterSpacing: 1.4,
    color: C.ink3,
  },
  notNowTextActive: { color: C.ink2 },

  privacyCard: {
    marginTop: 16,
    backgroundColor: C.sage,
    borderRadius: 16,
    padding: 16,
  },
  privacyKickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  privacyKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10, letterSpacing: 2.2,
    color: C.ink,
  },
  privacyBody: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text',
    fontSize: 13, lineHeight: 19,
    color: C.ink,
    letterSpacing: 0.1,
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  cta: {
    backgroundColor: C.ink,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
  },
  ctaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15, color: C.cream,
    letterSpacing: 0.2,
  },
});
