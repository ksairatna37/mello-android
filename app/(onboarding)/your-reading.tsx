/**
 * Your reading & save — 1:1 port of MBResultReading in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding.jsx
 *
 * Cream canvas. Top bar: "YOUR READING · COMPLETE".
 * Hero: orb (150px) with paper-circle check overlaid.
 * Kicker + Fraunces headline (italic emphasis) + body.
 * 5-dimension card (paper) with colored progress bars (0–100).
 * Interpretation card (ink bg, cream text) with the weakest dim italicized in coral.
 * Recommendations — 3 rows; the first is the "START HERE" coral primary.
 * Save card (coral bg) — primary "Save my reading" routes to save-profile;
 * "OR JUST CONTINUE" path skips auth and routes to welcome-aboard.
 *
 * Reads profile from cache (prefetched in questions.tsx). Falls back to
 * generateEmotionalProfile + saveEmotionalProfile if missing. Screen
 * becomes interactive once the profile is ready.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import SelfMindOrbV2 from '@/components/common/SelfMindOrbV2';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { generateEmotionalProfile, buildEmotionalAnswers } from '@/services/chat/bedrockService';
import { getEmotionalProfile, saveEmotionalProfile } from '@/utils/emotionalProfileCache';
import type { EmotionalProfile } from '@/services/chat/bedrockService';
import { getOnboardingData } from '@/utils/onboardingStorage';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Dimension presentation ─────────────────────────────────────────── */

type DimKey = 'calm' | 'clarity' | 'focus' | 'confidence' | 'positivity';

const DIMENSIONS: { key: DimKey; label: string; color: string }[] = [
  { key: 'calm',       label: 'Calm',       color: C.sage },
  { key: 'clarity',    label: 'Clarity',    color: C.peach },
  { key: 'focus',      label: 'Focus',      color: C.coral },
  { key: 'confidence', label: 'Confidence', color: C.lavender },
  { key: 'positivity', label: 'Positivity', color: C.butter },
];

/* ─── Static recommendations (design-literal) ────────────────────────── */

type GlyphKey = keyof typeof Glyphs;
const RECS: { t: string; sub: string; g: GlyphKey; c: string; primary?: boolean }[] = [
  { t: 'A 3-min voice hello',     sub: 'just say hi, no script',        g: 'Mic',  c: C.coral, primary: true },
  { t: 'Box breath · 4 min',       sub: 'for when the afternoon bends',  g: 'Leaf', c: C.sage  },
  { t: '"Sunday feeling" essay',   sub: '5 min read · Noa Vélez',        g: 'Book', c: C.lavender },
];

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/** Renders the Bedrock-generated `whatItMeans` text, italicizing the
 *  strongest dimension's name in coral so the visual matches the design.
 *  Falls back to a sentence built from the strongest dim if Bedrock didn't
 *  return text (e.g. older cached profile, parse failure). */
function renderWhatItMeans(
  text: string,
  strongest: { key: DimKey; label: string } | null,
): React.ReactNode {
  const fallback = strongest
    ? `Your ${strongest.label} is the strongest dimension right now — that steadiness is doing quiet work for you. Lean on it on the days the others wobble.`
    : "Your reading is in. Take it gently — there's no scoring to win here.";

  const body = (text && text.trim().length > 0) ? text : fallback;
  if (!strongest) return body;

  // Split on the strongest dim's label so we can italicize it inline.
  const parts = body.split(new RegExp(`(${strongest.label})`, 'i'));
  return parts.map((p, i) =>
    p.toLowerCase() === strongest.label.toLowerCase() ? (
      <Text key={i} style={styles.inkAccent}>{p}</Text>
    ) : (
      <Text key={i}>{p}</Text>
    ),
  );
}

/** Highest-scoring dimension — italic-emphasized in the "what it means"
 *  card and (when Bedrock returns whatItMeans) the model is also told to
 *  focus its reflection on this same dimension. */
function strongestDim(profile: EmotionalProfile): { key: DimKey; label: string } {
  let best = DIMENSIONS[0];
  let bestVal = profile[DIMENSIONS[0].key];
  for (const d of DIMENSIONS) {
    if (profile[d.key] > bestVal) {
      bestVal = profile[d.key];
      best = d;
    }
  }
  return { key: best.key, label: best.label };
}

/* ─── Screen ─────────────────────────────────────────────────────────── */

export default function YourReadingScreen() {
  const router = useRouter();
  // Whether the user is already authed. If so, the save card collapses
  // to a "Continue" CTA — no point sending an authed user to /save-profile.
  const { state: authState } = useAuth();
  const isAuthed = authState.kind === 'authed';
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<EmotionalProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let result = await getEmotionalProfile();
      if (!result) {
        const data = await getOnboardingData();
        const answers = buildEmotionalAnswers(data as Record<string, unknown>);
        result = await generateEmotionalProfile(answers);
        if (result) await saveEmotionalProfile(result);
      }
      if (!cancelled) setProfile(result);
    })();
    return () => { cancelled = true; };
  }, []);

  const strongest = useMemo(() => (profile ? strongestDim(profile) : null), [profile]);

  // Push, not replace: keeps the forward slide animation correct.
  //
  //   handleSave (unauthed)  → /save-profile (signup), then RouterGate /
  //                            save-profile's manual nav handles forward
  //                            routing to /permissions after auth.
  //   handleContinue (authed) → /permissions. The user is signed in
  //                            (Google/email) and walked the chain again
  //                            after a previous app-close. They still
  //                            need to confirm permissions before the
  //                            onboarding is considered complete on the
  //                            server. Going straight to /welcome-aboard
  //                            skipped this step and let users finish
  //                            without ever granting mic/notifications.
  const handleSave = () => router.push('/(onboarding)/save-profile' as any);
  const handleContinue = () => router.push('/(onboarding)/permissions' as any);

  // Hardware back: block. The reading is the user's own data — letting
  // them pop back into analysing or questions could re-trigger Bedrock,
  // double-charge tokens, and mutate their cached profile mid-view.
  // The two intentional exits are Save (→save-profile) and Continue
  // (→welcome-aboard) via the on-screen CTAs.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );

  /* ─── Entry fade — same pattern as welcome.tsx / analysing.tsx ──────── */
  const contentOpacity = useSharedValue(0);
  const contentFade = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
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

  /* ─── Loading state ─── */

  if (!profile) {
    return (
      <View style={[styles.container, styles.loadingWrap]}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <ActivityIndicator color={C.ink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar */}
      <Animated.View style={[styles.topBar, { paddingTop: insets.top + 12 }, contentFade]}>
        <View style={styles.topSide} />
        <Text style={styles.topLabel}>YOUR READING · COMPLETE</Text>
        <View style={styles.topSide} />
      </Animated.View>

      <Animated.View style={[{ flex: 1 }, contentFade]}>
        <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={24}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero — orb with paper-circle check pill overlaid in the center */}
            <View style={styles.hero}>
              <View style={styles.orbWrap}>
                <SelfMindOrbV2 size={250} onReady={handleOrbReady} disableInternalFade />
                <View style={styles.checkOverlay} pointerEvents="none">
                  <View style={styles.checkPill}>
                    <Glyphs.Check size={20} color={C.coral} />
                  </View>
                </View>
              </View>
            </View>

          <Text style={styles.h1}>
            Steady on the surface,{' '}
            <Text style={styles.h1Italic}>stirring</Text>{' '}
            underneath.
          </Text>
          {profile.interpretation ? (
            <Text style={styles.lede}>{profile.interpretation}</Text>
          ) : (
            <Text style={styles.lede}>
              You hold it together for everyone else — and carry a quieter weather system inside.
            </Text>
          )}

          {/* 5-dimension card */}
          <View style={[styles.card, { marginTop: 22 }]}>
            <View style={styles.dimHead}>
              <Text style={styles.kickerSmall}>— five soft dimensions</Text>
              <Text style={styles.dimRange}>0–100</Text>
            </View>
            <Text style={styles.dimTagline}>A snapshot, not a scorecard.</Text>
            <View style={{ marginTop: 14 }}>
              {DIMENSIONS.map((d, i) => (
                <View key={d.key} style={[styles.dimRow, i > 0 && { marginTop: 12 }]}>
                  <View style={styles.dimRowHead}>
                    <Text style={styles.dimLabel}>{d.label}</Text>
                    <Text style={styles.dimValue}>{profile[d.key]}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${profile[d.key]}%`, backgroundColor: d.color },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Interpretation card (ink). Body text is generated by Bedrock
              (`profile.whatItMeans`); we italicize occurrences of the
              strongest dimension's name in coral so the visual match with
              the design is preserved without hardcoding the prose. */}
          <View style={[styles.card, styles.inkCard]}>
            <Text style={[styles.kickerSmall, { color: 'rgba(251,245,238,0.55)' }]}>— what it means</Text>
            <Text style={styles.inkText}>
              {renderWhatItMeans(profile.whatItMeans, strongest)}
            </Text>
          </View>

         
          {/* Save / continue card (coral).
              Two variants:
              - Unauthed: "Save my reading" → routes to /save-profile (sign-up)
              - Authed:   "Continue" → routes straight to /welcome-aboard
                          (the user already has an account; pushing them to
                           /save-profile would briefly land on a pre-auth-only
                           screen and RouterGate would bounce them off again.) */}
          <View style={[styles.card, styles.saveCard]}>
            <Text style={styles.kickerSmall}>— don't lose this</Text>
            <Text style={styles.saveTitle}>
              {isAuthed ? (
                <>
                  Your reading is{' '}
                  <Text style={styles.saveTitleItalic}>safe</Text>{' '}
                  with us.
                </>
              ) : (
                <>
                  Save this reading so{' '}
                  <Text style={styles.saveTitleItalic}>future you</Text>{' '}
                  can find it.
                </>
              )}
            </Text>
            <Text style={styles.saveSub}>
              {isAuthed
                ? 'Tied to your account — you can come back, share it, or keep building on it.'
                : 'Create a small account — takes 30 seconds. Then you can come back, share it, or keep building on it.'}
            </Text>

            <TouchableOpacity
              onPress={isAuthed ? handleContinue : handleSave}
              style={styles.saveBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>
                {isAuthed ? 'Continue' : 'Save my reading'}
              </Text>
              <Glyphs.Arrow size={13} color={C.cream} />
            </TouchableOpacity>


          </View>
        </ScrollView>
      </FadingScrollWrapper>
      </Animated.View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  loadingWrap: { alignItems: 'center', justifyContent: 'center' },

  /* Top bar */
  topBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topSide: { width: 36 },
  topLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10, letterSpacing: 2.2,
    color: C.ink3,
  },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },

  /* Hero */
  hero: { alignItems: 'center', marginTop: 8 },
  orbWrap: { position: 'relative' },
  /* Full-bleed centering layer over the orb */
  checkOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  /* Paper circle that holds the coral check — matches the design's
     42×42 white pill with a soft ink drop shadow. */
  checkPill: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.paper,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },

  h1: {
    marginTop: 1,
    fontFamily: 'Fraunces',
    fontSize: 30, lineHeight: 41,
    letterSpacing: 0.3, color: C.ink,
    textAlign: 'center',
    paddingHorizontal: 6,
    // includeFontPadding:false removed — clips "stirring" descenders on
    // Android (see docs/ANDROID_TEXT_CROPPING_NOTE.md).
  },
  h1Italic: { fontFamily: 'Fraunces-Italic' },
  lede: {
    marginTop: 14,
    fontFamily: 'Fraunces-Text',
    fontSize: 14, lineHeight: 22,
    color: C.ink2, textAlign: 'center',
    letterSpacing: 0.2,
    paddingHorizontal: 8,
  },

  /* Generic card */
  card: {
    marginTop: 12,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    borderRadius: 22, padding: 18,
  },

  /* Dimensions card */
  dimHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  kickerSmall: {
    fontFamily: 'JetBrainsMono',
    fontSize: 11, letterSpacing: 2.2,
    color: C.ink3, textTransform: 'uppercase',
  },
  dimRange: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9, letterSpacing: 1.8,
    color: C.ink3,
  },
  dimTagline: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 15, letterSpacing: 0.2,
    color: C.ink,
  },
  dimRow: {},
  dimRowHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
  },
  dimLabel: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 14, letterSpacing: 0.2,
    color: C.ink,
  },
  dimValue: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 18, letterSpacing: 0.2,
    color: C.ink,
  },
  barTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(26,31,54,0.06)',
    marginTop: 6, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },

  /* Interpretation (ink) */
  inkCard: { backgroundColor: C.ink, borderColor: 'transparent' },
  inkText: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5, lineHeight: 22,
    color: 'rgba(251,245,238,0.88)',
    letterSpacing: 0.2,
  },
  inkAccent: { fontFamily: 'Fraunces-Italic', color: C.coral },

  /* Recommendations */
  recRow: {
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  recIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  recTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  recTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 15, letterSpacing: 0.2,
    color: C.ink,
  },
  recSub: {
    marginTop: 2,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 12, color: C.ink2,
    letterSpacing: 0.15,
  },
  startChip: {
    paddingVertical: 2, paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: C.ink,
  },
  startChipText: {
    fontFamily: 'JetBrainsMono',
    fontSize: 8, letterSpacing: 1.2,
    color: C.cream,
  },

  /* Save card */
  saveCard: {
    marginTop: 20,
    backgroundColor: C.coral,
    borderColor: 'transparent',
    padding: 20,
  },
  saveTitle: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 22, lineHeight: 28,
    letterSpacing: 0.2, color: C.ink,
  },
  saveTitleItalic: { fontFamily: 'Fraunces-MediumItalic' },
  saveSub: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text',
    fontSize: 13, lineHeight: 19,
    color: C.ink2, letterSpacing: 0.2,
  },
  saveBtn: {
    marginTop: 14,
    backgroundColor: C.ink,
    paddingVertical: 16, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  saveBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15, color: C.cream, letterSpacing: 0.2,
  },
  skipText: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9, letterSpacing: 1.6,
    color: C.ink2, textAlign: 'center',
  },
});
