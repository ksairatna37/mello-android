/**
 * Personalize — "Let's tune this for you."
 * Exact port of MBPersonalize in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding.jsx
 *
 * Sections:
 *   Top bar: back · STEP 3 OF 6 · SKIP
 *   Progress bar (6 segments, 3 filled)
 *   Kicker + H1 + body
 *   Section — what's loud in your head (multi-select colored chips)
 *   Section — how do you want it to sound? (pick one of 3)
 *   Primary CTA — "Continue"
 *
 * Navigation preserved: back → credibility (router.back), CTA → name-input.
 * Selections persist via onboardingStorage.update().
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { getOnboardingData, setOnboardingData } from '@/utils/onboardingStorage';

/* ─── Content (verbatim from design) ─────────────────────────────────── */

const TOPICS: { t: string; c: string }[] = [
  { t: 'anxiety',       c: C.coral },
  { t: 'burnout',       c: C.peach },
  { t: 'ADHD',          c: C.butter },
  { t: 'loneliness',    c: C.sage },
  { t: 'relationships', c: C.lavender },
  { t: 'grief',         c: C.cream2 },
  { t: 'depression',    c: '#E8A899' }, // design-literal — off-palette tone
  { t: 'sleep',         c: C.peach },
  { t: 'self-worth',    c: C.sage },
  { t: 'anger',         c: C.coral },
];

const TONES = [
  { k: 'soft-slow',     t: 'soft & slow' },
  { k: 'clear-direct',  t: 'clear & direct' },
  { k: 'bit-playful',   t: 'a bit playful' },
] as const;
type ToneKey = typeof TONES[number]['k'];

/* ─── Screen ─────────────────────────────────────────────────────────── */

export default function PersonalizeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Selection state — seeded to the design's default-on picks.
  // "When it matters most" / timeSlots was removed: it duplicated Q2
  // (when-is-it-hardest) which the user picks during the question flow.
  const [topics,    setTopics]    = useState<string[]>(['anxiety', 'burnout', 'relationships']);
  const [tone,      setTone]      = useState<ToneKey>('soft-slow');

  // Restore any prior selections from storage.
  useEffect(() => {
    (async () => {
      const d = await getOnboardingData();
      const t = (d as any).personalizeTopics;
      const to = (d as any).personalizeTone;
      if (Array.isArray(t)) setTopics(t);
      if (typeof to === 'string') setTone(to as ToneKey);
    })();
  }, []);

  // Back-handler: ALWAYS router.replace to /credibility. Never use
  // router.back() — when the user lands here via RouterGate's resume
  // on app reopen, the stack underneath is /, and back() would pop
  // there, then RouterGate would re-route to /personalize-intro
  // again. Replace explicitly avoids that loop regardless of entry.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/(onboarding)/credibility' as any);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router]),
  );

  const toggle = (list: string[], setList: (v: string[]) => void, key: string) => {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const persistAndGo = async (path: string) => {
    const d = await getOnboardingData();
    await setOnboardingData({
      ...d,
      ...(({ personalizeTopics: topics, personalizeTone: tone }) as any),
      updatedAt: new Date().toISOString(),
    });
    router.push(path as any);
  };

  const goBack = () => router.replace('/(onboarding)/credibility' as any);
  const goNext = () => persistAndGo('/(onboarding)/name-input');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar — matches credibility: back circle · centered label · spacer */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.topLabel}>LET{"’"}S PERSONALISE</Text>
        <View style={styles.topSpacer} />
      </View>

      <FadingScrollWrapper topFadeHeight={32} bottomFadeHeight={20}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <Text style={styles.h1}>
            Let's tune this for <Text style={styles.h1Italic}>you</Text>.
          </Text>
          <Text style={styles.lede}>
            What's loud in your head these days? Pick any that feel true. You can change this any time.
          </Text>

          {/* Topic chips */}
          <View style={styles.chipsWrap}>
            {TOPICS.map((chip) => {
              const on = topics.includes(chip.t);
              return (
                <TouchableOpacity
                  key={chip.t}
                  onPress={() => toggle(topics, setTopics, chip.t)}
                  activeOpacity={0.8}
                  style={[
                    styles.chip,
                    on ? { backgroundColor: chip.c, borderColor: 'transparent' } : styles.chipOff,
                  ]}
                >
                  {on && <Glyphs.Check size={12} color={C.ink} />}
                  <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{chip.t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tone picker */}
          <View style={{ marginTop: 28 }}>
            <Text style={styles.kicker}>— how do you want it to sound?</Text>
            <View style={styles.toneGrid}>
              {TONES.map((o) => {
                const sel = tone === o.k;
                return (
                  <TouchableOpacity
                    key={o.k}
                    onPress={() => setTone(o.k)}
                    activeOpacity={0.85}
                    style={[styles.toneItem, sel ? styles.toneItemOn : styles.toneItemOff]}
                  >
                    <Text style={[styles.toneLabel, sel && styles.toneLabelOn]}>{o.t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

        </ScrollView>
      </FadingScrollWrapper>

      {/* Pinned footer CTA — required across onboarding (see memory) */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.cta} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Continue</Text>
          <Glyphs.Arrow size={13} color={C.cream} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  /* Top bar */
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  topLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2.2,
    color: C.ink,
  },
  topSpacer: { width: 36 },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },

  /* Intro */
  kicker: {
    fontFamily: 'JetBrainsMono',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  h1: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 0.3,
    color: C.ink,
  },
  h1Italic: { fontFamily: 'Fraunces-MediumItalic' },
  lede: {
    fontFamily: 'Fraunces-Text',
    fontSize: 15,
    lineHeight: 24,
    color: C.ink2,
    marginTop: 14,
    letterSpacing: 0.2,
    maxWidth: 320,
  },

  /* Chips */
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 22,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  chipOff: {
    backgroundColor: C.paper,
    borderColor: C.line2,
  },
  chipLabel: {
    fontFamily: 'Fraunces',
    fontSize: 15,
    letterSpacing: 0.2,
    color: C.ink,
  },
  chipLabelOn: { fontFamily: 'Fraunces-Italic' },

  /* Tone grid (3 equal columns) */
  toneGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  toneItem: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  toneItemOn:  { backgroundColor: C.ink, borderColor: 'transparent' },
  toneItemOff: { backgroundColor: C.paper, borderColor: C.line2 },
  toneLabel: {
    fontFamily: 'Fraunces',
    fontSize: 13,
    letterSpacing: 0.2,
    color: C.ink,
    textAlign: 'center',
  },
  toneLabelOn: { color: C.cream },

  /* Pinned footer CTA */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  cta: {
    backgroundColor: C.ink,
    paddingVertical: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: C.cream,
    letterSpacing: 0.2,
  },
});
