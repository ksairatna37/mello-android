/**
 * Credibility — 1:1 port of the redesigned MBCredibility in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding.jsx
 *
 * Cream canvas with ambient peach + lavender blurs. Top bar with back
 * chevron + "BEFORE WE BEGIN" mono kicker. Italic-on-"how I listen"
 * Fraunces 34 headline. "Listening signature" SVG hero — a soft hill
 * of vertical lines with three colored dots above, each marking a
 * "noticed moment" (a small word / a long pause / a feeling, named).
 * Three vertical pillar cards (TRAINED ON · REVIEWED BY HUMANS ·
 * WHAT I'M NOT). Sage privacy strip. Pinned ink CTA.
 *
 * Navigation preserved: back → welcome, CTA → personalize-intro.
 */

import React, { useCallback } from 'react';
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
import Svg, { Defs, RadialGradient, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Soft glow (RadialGradient — no hard edges) ──────────────────── */

function SoftGlow({
  size,
  color,
  centerOpacity,
  style,
}: {
  size: number;
  color: string;
  centerOpacity: number;
  style: any;
}) {
  const id = React.useMemo(
    () => `cred-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );
  return (
    <View pointerEvents="none" style={style}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <Stop offset="0%"   stopColor={color} stopOpacity={centerOpacity} />
            <Stop offset="55%"  stopColor={color} stopOpacity={centerOpacity * 0.45} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/* ─── Listening signature hero ────────────────────────────────────── */

function ListeningSignature() {
  // 48 vertical lines, taller in the middle (bell curve), small sin
  // perturbation so it reads organic. Three colored "noticed moments"
  // sit above with hairline dashed tethers down to the band.
  const lines = React.useMemo(() => {
    const arr: { x: number; t: number; h: number; opacity: number }[] = [];
    for (let i = 0; i < 48; i++) {
      const x = 8 + i * 6.5;
      const t = (i - 23.5) / 24;
      const h = Math.exp(-t * t * 2.2) * 54 + 6 + Math.sin(i * 0.7) * 3;
      const opacity = 0.18 + Math.exp(-t * t * 1.8) * 0.5;
      arr.push({ x, t, h, opacity });
    }
    return arr;
  }, []);

  const moments = [
    { x: 78,  c: C.coral,    label: 'a small word' },
    { x: 160, c: C.lavender, label: 'a long pause' },
    { x: 246, c: '#D4B872',  label: 'a feeling, named' }, // butter-deep accent
  ];

  return (
    <View style={styles.signatureWrap}>
      <Svg width="100%" height={130} viewBox="0 0 320 130">
        {lines.map((l, i) => (
          <Line
            key={i}
            x1={l.x} x2={l.x}
            y1={70 - l.h / 2} y2={70 + l.h / 2}
            stroke={C.ink}
            strokeOpacity={l.opacity}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ))}
        {moments.map((m, i) => (
          <React.Fragment key={i}>
            <Line
              x1={m.x} y1={70} x2={m.x} y2={26}
              stroke={C.ink} strokeOpacity={0.18}
              strokeWidth={0.8} strokeDasharray="2,2"
            />
            <Circle cx={m.x} cy={22} r={6}   fill={m.c} />
            <Circle cx={m.x} cy={22} r={2.5} fill={C.cream} />
          </React.Fragment>
        ))}
        <SvgText
          x={160} y={118}
          fontSize={9}
          fontFamily="JetBrainsMono"
          fontWeight="500"
          fill={C.ink3}
          textAnchor="middle"
          letterSpacing={1.1}
          
        >
          WHAT YOU SAY · WHAT I NOTICE
        </SvgText>
      </Svg>
    </View>
  );
}

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function CredibilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAuth();

  /**
   * /credibility plays two roles:
   *
   *   (a) Forward step in the pre-auth onboarding chain.
   *       Unauthed user came from /welcome via push; back returns
   *       them there.
   *
   *   (b) Cold-boot landing for a returning authed-incomplete user.
   *       RouterGate dropped them here directly. There is nothing
   *       behind this screen on the stack, and /welcome isn't a
   *       coherent destination for an authed user (RouterGate would
   *       just bounce them right back). For these users, hardware
   *       back simply closes the app — same as backing off the home
   *       screen of any other app.
   */
  const isAuthedIncomplete =
    state.kind === 'authed' && state.profile?.onboarding_completed === false;

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (isAuthedIncomplete) {
          BackHandler.exitApp();
          return true;
        }
        router.replace('/(onboarding)/welcome' as any);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router, isAuthedIncomplete]),
  );

  const goBack = () => {
    if (isAuthedIncomplete) {
      BackHandler.exitApp();
      return;
    }
    router.replace('/(onboarding)/welcome' as any);
  };
  const goNext = () => router.push('/(onboarding)/personalize-intro' as any);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Ambient color fields */}
      <SoftGlow
        size={420}
        color={C.peach}
        centerOpacity={0.42}
        style={{ position: 'absolute', top: -160, right: -150 }}
      />
      <SoftGlow
        size={460}
        color={C.lavender}
        centerOpacity={0.45}
        style={{ position: 'absolute', bottom: -200, left: -160 }}
      />

      {/* Top bar — chevron hidden for authed-incomplete users since
          /credibility is their entry point and there's nowhere meaningful
          to go back to (RouterGate owns the cold-boot routing). They can
          still hardware-back to close the app. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        {isAuthedIncomplete ? (
          <View style={styles.topSide} />
        ) : (
          <TouchableOpacity
            onPress={goBack}
            style={styles.backBtn}
            activeOpacity={0.85}
            hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
          >
            <Glyphs.Back size={18} color={C.ink} />
          </TouchableOpacity>
        )}
        <View style={styles.topSide} />
        <View style={styles.topSide} />
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={32}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
        >
        {/* Hero text */}
        <Text style={styles.headline} numberOfLines={2}>
          A little about{'\n'}
          <Text style={styles.headlineItalic}>how I listen</Text>.
        </Text>
        <Text style={styles.body}>
          Not a quiz. Not a script. Just a few quiet things you should know.
        </Text>

        {/* Listening signature */}
        <ListeningSignature />

        {/* Three italic captions matching the dots above */}
        <View style={styles.captionsRow}>
          {[
            { c: C.coral,    t: 'a small word' },
            { c: C.lavender, t: 'a long pause' },
            { c: C.butter,   t: 'a feeling, named' },
          ].map((m, i) => (
            <View key={i} style={styles.captionItem}>
              <View style={[styles.captionDot, { backgroundColor: m.c }]} />
              <Text style={styles.captionText}>{m.t}</Text>
            </View>
          ))}
        </View>

        {/* Pillars */}
        <View style={styles.pillars}>
          {/* Pillar 1 — TRAINED ON */}
          <View style={[styles.pillarCard, styles.pillarPaper]}>
            <Text style={[styles.pillarKicker, { color: C.coral }]}>— TRAINED ON</Text>
            <Text style={styles.pillarTitle} numberOfLines={2}>
              <Text style={styles.italic}>decades</Text> of clinical practice
            </Text>
            <Text style={styles.pillarFootItalic}>
              Three approaches that hold up under research — woven into one voice.
            </Text>

            {/* Plain-English legend so initials are decipherable for
                first-time users without clinical vocabulary. Sits in
                the same card so it reads as a footnote, not noise. */}
            <View style={styles.modalityLegend}>
              {[
                { abbr: 'CBT', full: 'Cognitive Behavioral Therapy', c: C.coral    },
                { abbr: 'ACT', full: 'Acceptance & Commitment Therapy', c: C.lavender },
                { abbr: 'IFS', full: 'Internal Family Systems', c: C.sage     },
              ].map((m, i) => (
                <View key={i} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: m.c }]} />
                  <Text style={styles.legendAbbr}>{m.abbr}</Text>
                  <Text style={styles.legendFull}>{m.full}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Pillar 2 — REVIEWED BY HUMANS */}
          <View style={[styles.pillarCard, styles.pillarButter]}>
            <Text style={[styles.pillarKicker, { color: 'rgba(26,31,54,0.55)' }]}>— REVIEWED BY HUMANS</Text>
            <View style={styles.bigNumberRow}>
              <Text style={styles.bigNumber}>8,400</Text>
              <Text style={styles.bigNumberItalic}>sessions</Text>
            </View>
            <Text style={styles.pillarBody}>
              Every conversation that shaped me was first read by a licensed clinician. Not scraped from the internet.
            </Text>
          </View>

          {/* Pillar 3 — WHAT I'M NOT */}
          <View style={[styles.pillarCard, styles.pillarInk]}>
            <Text style={[styles.pillarKicker, { color: 'rgba(251,245,238,0.5)' }]}>— WHAT I’M NOT</Text>
            <Text style={styles.pillarTitleInk}>
              Not a <Text style={[styles.italic, { color: C.coral }]}>therapist</Text>. Not a diagnosis.
            </Text>
            <Text style={styles.pillarBodyInk}>
              If something bigger is happening, I’ll say so — and help you find a human.
            </Text>
            <View style={styles.crisisRow}>
              <View style={styles.crisisDot} />
              <Text style={styles.crisisLabel}>CRISIS LINES BUILT IN · ALWAYS ONE TAP AWAY</Text>
            </View>
          </View>
        </View>

        {/* Sage privacy strip */}
        <View style={styles.privacyStrip}>
          <Glyphs.Leaf size={16} color={C.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>
              Your words stay <Text style={styles.italic}>yours</Text>.
            </Text>
            <Text style={styles.privacyMono}>
              ENCRYPTED · NEVER SOLD · DELETABLE ANY TIME
            </Text>
          </View>
        </View>
        </ScrollView>
      </FadingScrollWrapper>

      {/* Pinned CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.cta} onPress={goNext} activeOpacity={0.9}>
          <Text style={styles.ctaText}>Okay, let{'’'}s begin</Text>
          <Glyphs.Arrow size={13} color={C.cream} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream, overflow: 'hidden' },

  topBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topSide: { width: 36, height: 36 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  headline: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 34, lineHeight: 42,
    letterSpacing: -0.5,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  body: {
    marginTop: 12,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5, lineHeight: 21,
    color: C.ink2,
    maxWidth: 300,
    letterSpacing: 0.1,
  },

  signatureWrap: {
    marginTop: 28,
    height: 130,
    alignItems: 'center', justifyContent: 'center',
  },

  captionsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 6, marginTop: 6,
  },
  captionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  captionDot: { width: 6, height: 6, borderRadius: 3 },
  captionText: {
    fontFamily: 'Fraunces-Italic',
    fontSize: 11.5, color: C.ink2,
    letterSpacing: 0.05,
  },

  pillars: { marginTop: 30, gap: 10 },
  pillarCard: { borderRadius: 20, padding: 18, overflow: 'hidden' },
  pillarPaper: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line },
  pillarButter: { backgroundColor: C.butter },
  pillarInk: { backgroundColor: C.ink },

  pillarKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9, letterSpacing: 1.4,
  },
  pillarTitle: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 22, lineHeight: 30,
    letterSpacing: -0.2,
    color: C.ink,
  },
  pillarTitleInk: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 22, lineHeight: 30,
    letterSpacing: -0.2,
    color: C.cream,
  },
  italic: { fontFamily: 'Fraunces-MediumItalic' },

  pillarFootItalic: {
    marginTop: 12,
    fontFamily: 'Fraunces-Italic',
    fontSize: 12.5, lineHeight: 18,
    color: C.ink2,
  },
  modalityLegend: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,31,54,0.06)',
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 6, height: 6, borderRadius: 3,
    flexShrink: 0,
  },
  legendAbbr: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9, letterSpacing: 1.0,
    color: C.ink,
    width: 24,
  },
  legendFull: {
    fontFamily: 'Fraunces-Text',
    fontSize: 11.5, lineHeight: 14,
    color: C.ink2,
    flex: 1,
  },
  pillarBody: {
    marginTop: 8,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5, lineHeight: 19,
    color: C.ink2,
    letterSpacing: 0.05,
  },
  pillarBodyInk: {
    marginTop: 10,
    fontFamily: 'Fraunces-Italic',
    fontSize: 12.5, lineHeight: 18,
    color: 'rgba(251,245,238,0.7)',
  },

  bigNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  bigNumber: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 56, lineHeight: 56,
    letterSpacing: -2,
    color: C.ink,
    includeFontPadding: false,
  },
  bigNumberItalic: {
    fontFamily: 'Fraunces-Italic',
    fontSize: 16, color: C.ink2,
  },

  crisisRow: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(251,245,238,0.1)',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  crisisDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.sage },
  crisisLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9, letterSpacing: 0.8,
    color: 'rgba(251,245,238,0.7)',
    flex: 1,
  },

  privacyStrip: {
    marginTop: 14, padding: 14,
    backgroundColor: C.sage, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  privacyTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 14, lineHeight: 18,
    letterSpacing: 0.05,
    color: C.ink,
    includeFontPadding: false,
  },
  privacyMono: {
    marginTop: 3,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9, letterSpacing: 0.8,
    color: 'rgba(26,31,54,0.55)',
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
