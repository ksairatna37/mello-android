/**
 * Analysing — 1:1 port of MBAnalyzing in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding.jsx
 *
 * Cream canvas with peach/lavender/butter ambient blurs, centered orb,
 * cycling italic phrase, shimmer dots, and a 4-step checklist that
 * ticks off as the emotional profile is built in the background.
 *
 * Polls the emotional-profile cache (prefetched during questions).
 * When ready, the checklist completes and the Continue button reveals;
 * tapping it routes to /your-reading.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, BackHandler } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import SelfMindOrbV2 from '@/components/common/SelfMindOrbV2';
import { getEmotionalProfile, saveEmotionalProfile } from '@/utils/emotionalProfileCache';
import {
  generateEmotionalProfile,
  buildEmotionalAnswers,
  composeDeterministicProfile,
} from '@/services/chat/bedrockService';
import { getOnboardingData } from '@/utils/onboardingStorage';

const PHRASES = [
  'reading the shape of your answers…',
  'looking for the quiet patterns…',
  'nothing is being diagnosed here…',
  'drafting a reading, just for you…',
];

/* ─── Shimmer dot (breathing opacity) ───────────────────────────────── */

function ShimmerDot({ color, delay }: { color: string; delay: number }) {
  const op = useSharedValue(0.4);
  useEffect(() => {
    op.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1,   { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [op, delay]);
  const s = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.View style={[styles.shimmerDot, { backgroundColor: color }, s]} />;
}

/* ─── Checklist item ─────────────────────────────────────────────────── */

type StepState = 'done' | 'active' | 'idle';

function ChecklistItem({ label, state, first }: { label: string; state: StepState; first: boolean }) {
  return (
    <View style={[styles.stepRow, !first && { marginTop: 10 }]}>
      <View
        style={[
          styles.stepBox,
          state === 'done'   && styles.stepBoxDone,
          state === 'active' && styles.stepBoxActive,
          state === 'idle'   && styles.stepBoxIdle,
        ]}
      >
        {state === 'done'   && <Glyphs.Check size={11} color={C.cream} />}
        {state === 'active' && <View style={styles.stepActiveDot} />}
      </View>
      <Text
        style={[
          styles.stepLabel,
          state === 'done'   && styles.stepLabelDone,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────────── */

export default function AnalysingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Cycle italic phrase every 2.4 s
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 2400);
    return () => clearInterval(t);
  }, []);

  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [profileReady, setProfileReady] = useState(false);

  // Block hardware back during the validation gate. Once `profileReady`
  // is true the user can navigate forward via Continue (designed exit);
  // back-stepping mid-gen would re-fire Bedrock generate from questions
  // and waste tokens on a duplicate call.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );

  /**
   * Validation gate. Runs in parallel with the breathing animation. The
   * Continue button reveals only after a VALIDATED profile is in cache.
   *
   * Order:
   *   1. Poll cache for ~6s. The questions screen kicks off Bedrock
   *      generation in the background; usually it lands in 1–2s.
   *   2. If still empty: regenerate once at higher temperature for
   *      variation (sometimes the model is stuck in a bad attractor at
   *      0.3 and a brief perturbation helps).
   *   3. If THAT still rejects: derive a deterministic profile from
   *      the user's own answers via heuristics. Honest, accurate, never
   *      contradicts the inputs.
   *
   * The user always sees the analysing animation finish into a real
   * reading — never a broken next-screen, never fabricated content.
   */
  useEffect(() => {
    let mounted = true;
    const t1 = setTimeout(() => mounted && setPhase(1), 800);
    const t2 = setTimeout(() => mounted && setPhase(2), 1700);
    const t3 = setTimeout(() => mounted && setPhase(3), 2800);

    let cancelled = false;

    const finish = () => {
      if (!cancelled) { setProfileReady(true); setPhase(4); }
    };

    (async () => {
      // ── Step 1: poll the cache (LLM generation kicked off from the
      // questions screen). 12 × 500ms = up to 6s.
      for (let i = 0; i < 12 && !cancelled; i++) {
        const p = await getEmotionalProfile();
        if (p) { finish(); return; }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (cancelled) return;

      // ── Step 2: retry the LLM once at a higher temperature.
      try {
        const data = await getOnboardingData();
        const answers = buildEmotionalAnswers(data as Record<string, unknown>);
        if (answers.length > 0) {
          console.log('[Analysing] Retrying LLM at temperature 0.6');
          const retry = await generateEmotionalProfile(answers, { temperature: 0.6 });
          if (cancelled) return;
          if (retry) {
            await saveEmotionalProfile(retry);
            finish();
            return;
          }

          // ── Step 3: deterministic fallback from the user's answers.
          console.warn(
            '[Analysing] LLM rejected twice — using deterministic profile from answers',
          );
          const safe = composeDeterministicProfile(data as Record<string, unknown>);
          await saveEmotionalProfile(safe);
          if (!cancelled) finish();
          return;
        }
      } catch (err) {
        console.warn('[Analysing] Retry pipeline error:', err);
      }

      // ── Final guard: if even the deterministic path fails for some
      // reason (e.g. storage error), surface Continue so the user is
      // not stranded; your-reading.tsx has its own null-handling.
      finish();
    })();

    return () => {
      mounted = false;
      cancelled = true;
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, []);

  /* ─── Entry fade — same pattern as welcome.tsx ─────────────────────────
   * One opacity drives the orb + center stack + top bar on every focus.
   * First focus: orb's onReady triggers the fade. Return focus: 120ms
   * delay covers WebView surface re-attach. 1500ms safety net. */
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

  // Reveal Continue button once profile is ready
  const btnOpacity = useSharedValue(0);
  const btnY = useSharedValue(12);
  useEffect(() => {
    if (profileReady) {
      btnOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
      btnY.value      = withDelay(300, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
    }
  }, [profileReady, btnOpacity, btnY]);
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnY.value }],
  }));

  // Push, not replace: forward transition animates as a slide-in from
  // right. /your-reading blocks hardware back so leaving /analysing on
  // the stack underneath is safe.
  const handleContinue = () => router.push('/(onboarding)/your-reading' as any);

  const stepState = (step: number): StepState => {
    if (step < phase)  return 'done';
    if (step === phase) return 'active';
    return 'idle';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar */}
      <Animated.View style={[styles.topBar, { paddingTop: insets.top + 12 }, contentFade]}>
        <View style={styles.topSide} />
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>ANALYZING · PRIVATE</Text>
        </View>
        <View style={styles.topSide} />
      </Animated.View>

      {/* Center stack */}
      <Animated.View style={[styles.center, contentFade]}>
        <SelfMindOrbV2 size={270} onReady={handleOrbReady} disableInternalFade />

        <Text style={styles.phrase} numberOfLines={2}>
          {PHRASES[phraseIdx]}
        </Text>

        <Text style={styles.bodyLine}>
          This takes about 10 seconds. I'm reading every answer — no templates.
        </Text>

        <View style={styles.dotsRow}>
          <ShimmerDot color={C.coral}    delay={0}   />
          <ShimmerDot color={C.lavender} delay={180} />
          <ShimmerDot color={C.butter}   delay={360} />
        </View>

        <View style={styles.checklist}>
          <ChecklistItem first       label="reading 10 answers"        state={stepState(1)} />
          <ChecklistItem first={false} label="noticing the patterns"    state={stepState(2)} />
          <ChecklistItem first={false} label="drafting your reading"    state={stepState(3)} />
          <ChecklistItem first={false} label="choosing gentle next steps" state={stepState(4)} />
        </View>
      </Animated.View>

      {/* Continue — revealed when ready */}
      <Animated.View
        style={[styles.footer, { paddingBottom: insets.bottom + 20 }, btnStyle]}
        pointerEvents={profileReady ? 'auto' : 'none'}
      >
        <TouchableOpacity onPress={handleContinue} style={styles.cta} activeOpacity={0.85}>
          <Text style={styles.ctaText}>See your reading</Text>
          <Glyphs.Arrow size={13} color={C.cream} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream, overflow: 'hidden' },

  topBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topSide: { width: 36 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.coral },
  statusText: { fontFamily: 'JetBrainsMono-Medium', fontSize: 10, letterSpacing: 2.2, color: C.ink3 },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingBottom: 40,
  },
  phrase: {
    marginTop: 18,
    fontFamily: 'Fraunces-Italic',
    fontSize: 24, lineHeight: 35,
    letterSpacing: 0.2, color: C.ink,
    textAlign: 'center', maxWidth: 300,
    // includeFontPadding:false removed — clips Fraunces descenders on Android
    // (see docs/ANDROID_TEXT_CROPPING_NOTE.md).
  },
  bodyLine: {
    marginTop: 16,
    fontFamily: 'Fraunces-Text',
    fontSize: 13, lineHeight: 20,
    color: C.ink2, textAlign: 'center',
    maxWidth: 300, letterSpacing: 0.2,
  },

  dotsRow: { flexDirection: 'row', gap: 10, marginTop: 28 },
  shimmerDot: { width: 10, height: 10, borderRadius: 5 },

  checklist: {
    marginTop: 36,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    borderRadius: 22,
    padding: 18,
    width: '100%',
    maxWidth: 320,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBox: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepBoxDone:   { backgroundColor: C.ink },
  stepBoxActive: { borderWidth: 2,   borderColor: C.coral },
  stepBoxIdle:   { borderWidth: 1.5, borderColor: C.line2 },
  stepActiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.coral },
  stepLabel: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 13.5, letterSpacing: 0.2,
    color: C.ink,
  },
  stepLabelDone: { color: C.ink3, textDecorationLine: 'line-through' },

  footer: { paddingHorizontal: 20 },
  cta: {
    backgroundColor: C.ink,
    paddingVertical: 16, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  ctaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15, color: C.cream, letterSpacing: 0.2,
  },
});
