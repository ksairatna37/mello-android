/**
 * Welcome aboard — 1:1 port of MBWelcomeOnboard in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding.jsx
 *
 * Peach canvas with coral + lavender ambient blurs, breathing orb, kicker
 * "you're in", italic-on-name headline, primary "first gentle thing" card
 * with coral icon tile, three secondary route cards (note / breath / browse),
 * trailing "OR JUST BROWSE · NO PRESSURE" mono footer.
 *
 * Auth wiring preserved:
 *   - getOnboardingData() reads firstName for the headline
 *   - completeOnboarding() from AuthContext exits onboarding and routes
 *     to the main app (every CTA on this screen calls it)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  BackHandler,
  ActivityIndicator,
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
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import SelfMindOrbV2 from '@/components/common/SelfMindOrbV2';
import { getOnboardingData } from '@/utils/onboardingStorage';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Screen ─────────────────────────────────────────────────────── */

export default function WelcomeAboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Hardware back: block. This screen is the finalize moment — every CTA
  // calls completeOnboarding() inline. Letting back pop the stack would
  // re-expose authenticated-already screens (permissions/save-profile).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );

  const { completeOnboarding } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  useEffect(() => {
    getOnboardingData().then((d) => {
      if (d.firstName) setFirstName(d.firstName);
    });
  }, []);

  /* Entry fade — same pattern as welcome / analysing / your-reading.
   * One opacity drives the orb + header + card + list. First focus waits
   * on the orb's onReady so the WebView painted before content appears.
   * Hardware back is blocked on this screen so a true return-focus path
   * doesn't exist, but we keep the pattern consistent for sibling parity
   * and a 1500ms safety net for the rare onLoadEnd-never-fires case. */
  const contentOpacity = useSharedValue(0);
  const orbHasLoadedRef = useRef(false);
  const focusFadePendingRef = useRef(false);

  const playFade = useCallback(
    (delayMs: number) => {
      contentOpacity.value = 0;
      contentOpacity.value = withDelay(
        delayMs,
        withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
      );
    },
    [contentOpacity],
  );

  const handleOrbReady = useCallback(() => {
    orbHasLoadedRef.current = true;
    if (focusFadePendingRef.current) {
      focusFadePendingRef.current = false;
      playFade(0);
    }
  }, [playFade]);

  useFocusEffect(
    useCallback(() => {
      if (orbHasLoadedRef.current) {
        playFade(120);
      } else {
        focusFadePendingRef.current = true;
      }
      return () => { focusFadePendingRef.current = false; };
    }, [playFade]),
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (!orbHasLoadedRef.current) playFade(0);
    }, 1500);
    return () => clearTimeout(t);
  }, [playFade]);

  // Header / card / list share the same fade — preserves the staggered feel
  // via tiny progressive translateY only, while opacity stays unified so the
  // surface arrives as one piece in lockstep with the orb's first paint.
  const headerStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: (1 - contentOpacity.value) * 14 }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: (1 - contentOpacity.value) * 10 }],
  }));
  const listStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: (1 - contentOpacity.value) * 8 }],
  }));

  /**
   * Finalize onboarding inline:
   *   1. Phase 1 — sync answers to user_onboarding (idempotent, retried).
   *   2. Phase 2 — flip profile.onboarding_completed=true (retried).
   * On success, RouterGate routes the now-authed-complete user to /chat
   * automatically — no manual navigation required. Failure surfaces a
   * tap-to-retry pill below the primary CTA; AuthContext's retry chain
   * makes the operation eventually consistent so a single retry usually
   * succeeds.
   *
   * Re-entry guard: if a previous tap is still in flight, additional
   * taps are ignored. The primary CTA shows a spinner; secondary cards
   * dim via the same loading flag.
   */
  const handleContinue = useCallback(async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    setCompleteError(null);
    try {
      await completeOnboarding();
      // RouterGate sees onboarding_completed=true → routes to /chat.
    } catch (err: any) {
      console.error('[welcome-aboard] completeOnboarding failed:', err);
      setCompleteError(
        err?.message?.length
          ? `${err.message}. Tap to retry.`
          : "Couldn't sync your progress. Tap to retry.",
      );
    } finally {
      setIsCompleting(false);
    }
  }, [completeOnboarding, isCompleting]);

  const routes = [
    { label: 'Write a small note', sub: 'just a few words · 2 min', Icon: Glyphs.Book, tile: C.sage },
    { label: 'Try box breath',     sub: 'with a dark screen · 4 min', Icon: Glyphs.Moon, tile: C.lavender },
    { label: 'Look around',        sub: 'open the app · no timer',    Icon: Glyphs.Home, tile: C.butter },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

    

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topSide} />
        <View style={styles.topSide} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: orb + kicker + headline + body */}
        <Animated.View style={[styles.header, headerStyle]}>
          <View style={styles.orbWrap}>
            <SelfMindOrbV2 size={170} onReady={handleOrbReady} disableInternalFade />
          </View>

          <Text style={styles.headline} numberOfLines={2}>
            Welcome
            {firstName ? ', ' : ''}
            {!!firstName && <Text style={styles.headlineItalic}>{firstName}</Text>}
            .
          </Text>
          <Text style={styles.body}>
            Based on what you shared, here{'’'}s where I{'’'}d start. You can always do something else.
          </Text>
        </Animated.View>

        {/* Primary "first gentle thing" card */}
        <Animated.View style={[styles.primaryCard, cardStyle]}>
          <Text style={styles.cardKicker}>YOUR FIRST, GENTLE THING</Text>
          <View style={styles.primaryRow}>
            <View style={[styles.iconTile, { backgroundColor: C.coral }]}>
              <Glyphs.Wave size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.primaryTitle}>A 3-minute hello</Text>
              <Text style={styles.primarySub}>voice · no script, just say hi</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.cta, isCompleting && styles.ctaDim]}
            onPress={handleContinue}
            disabled={isCompleting}
            activeOpacity={0.9}
          >
            {isCompleting ? (
              <>
                <ActivityIndicator color={C.cream} size="small" />
                <Text style={styles.ctaText}>Just a moment…</Text>
              </>
            ) : (
              <>
                <Text style={styles.ctaText}>Start the hello</Text>
                <Glyphs.Arrow size={13} color={C.cream} />
              </>
            )}
          </TouchableOpacity>

          {/* Retry surface — tap-to-retry pill if completeOnboarding errored */}
          {!!completeError && (
            <TouchableOpacity
              onPress={handleContinue}
              activeOpacity={0.8}
              style={styles.errorPill}
              disabled={isCompleting}
            >
              <Text style={styles.errorText}>{completeError}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Slower routes */}
        <Animated.View style={[styles.routes, listStyle]}>
          <Text style={styles.cardKicker}>OR TAKE A SLOWER ROUTE</Text>
          <View style={{ marginTop: 10, gap: 8 }}>
            {routes.map((r, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.routeRow, isCompleting && styles.routeRowDim]}
                onPress={handleContinue}
                disabled={isCompleting}
                activeOpacity={0.85}
              >
                <View style={[styles.routeTile, { backgroundColor: r.tile }]}>
                  <r.Icon size={14} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeTitle}>{r.label}</Text>
                  <Text style={styles.routeSub}>{r.sub}</Text>
                </View>
                <Glyphs.Arrow size={14} color={C.ink3} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Browse footer */}
        <TouchableOpacity
          onPress={handleContinue}
          disabled={isCompleting}
          activeOpacity={0.7}
          style={styles.browseRow}
        >
          <Text style={styles.browseText}>OR JUST BROWSE · NO PRESSURE</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.peach, overflow: 'hidden' },

  blob: { position: 'absolute', borderRadius: 999 },
  blobTopRight: {
    top: -80, right: -80, width: 320, height: 320,
    backgroundColor: C.coral, opacity: 0.4,
  },
  blobBottomLeft: {
    bottom: -120, left: -60, width: 320, height: 320,
    backgroundColor: C.lavender, opacity: 0.5,
  },

  topBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topSide: { width: 36, height: 36 },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  header: { alignItems: 'center', marginTop: 10 },
  orbWrap: { marginTop: 10, marginBottom: 6 },
  headline: {
    marginTop: 18,
    fontFamily: 'Fraunces-Medium',
    fontSize: 36, lineHeight: 44,
    letterSpacing: -0.4,
    color: C.ink,
    textAlign: 'center',
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  body: {
    marginTop: 14,
    fontFamily: 'Fraunces-Text',
    fontSize: 14, lineHeight: 22,
    color: C.ink2,
    textAlign: 'center',
    maxWidth: 300,
    letterSpacing: 0.1,
  },

  primaryCard: {
    marginTop: 24,
    backgroundColor: C.paper,
    borderRadius: 22,
    padding: 18,
  },
  cardKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10, letterSpacing: 2.2,
    color: C.ink3,
  },
  primaryRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 16, lineHeight: 22, color: C.ink,
    letterSpacing: -0.1,
  },
  primarySub: {
    marginTop: 2,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 12, color: C.ink2,
  },
  cta: {
    marginTop: 14,
    backgroundColor: C.ink,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
  },
  ctaDim: { opacity: 0.7 },
  ctaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15, color: C.cream,
    letterSpacing: 0.2,
  },
  errorPill: {
    marginTop: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(244,169,136,0.18)',
    borderWidth: 1, borderColor: 'rgba(244,169,136,0.55)',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 12,
    color: C.coral,
    textAlign: 'center',
  },
  routeRowDim: { opacity: 0.55 },

  routes: { marginTop: 18 },
  routeRow: {
    backgroundColor: C.paper,
    borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center',
    gap: 12,
  },
  routeTile: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  routeTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 14, color: C.ink,
    letterSpacing: -0.1,
    includeFontPadding: false,
  },
  routeSub: {
    marginTop: 2,
    fontFamily: 'JetBrainsMono',
    fontSize: 10, letterSpacing: 0.8,
    color: C.ink3,
  },

  browseRow: {
    alignItems: 'center',
    marginTop: 22,
    paddingVertical: 6,
  },
  browseText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10, letterSpacing: 2.2,
    color: C.ink3,
  },
});
