/**
 * DidYouKnow — 1:1 port of (the redesigned) MBDidYouKnow in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding-q.jsx
 *
 * Ink canvas with three ambient color fields (coral / lavender-deep / butter),
 * faded "5 / 10 · A SMALL PAUSE" mono kicker, 10-segment progress (5 filled
 * coral), sparkle "DID YOU KNOW" kicker, hero "6s" coral number, headline,
 * amygdala→prefrontal visual, UCLA attribution, coral primary CTA.
 *
 * Public contract preserved: { topInset, bottomInset, onContinue, onBack, firstName? }.
 * Rendered between Q5 and Q6 inside the questions FlatList.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';

interface DidYouKnowProps {
  firstName?: string;
  topInset: number;
  bottomInset: number;
  onContinue: () => void;
  onBack: () => void;
}

/* ─── Soft glow ──────────────────────────────────────────────────────
 *
 * The design's ambient color fields are `filter: blur(70-80px)` radial
 * blooms — they have no visible edge, just light bleeding into the
 * navy. React Native has no CSS-style filter:blur on arbitrary views,
 * so a `<View>` with `borderRadius` + `opacity` renders as a hard disc
 * with a clearly defined edge. The fix is an SVG `RadialGradient` that
 * fades the color from `centerOpacity` at the middle to `0` at the
 * radius, which visually matches the `blur()` softness without the
 * native blur cost.
 */

interface SoftGlowProps {
  size: number;
  color: string;
  centerOpacity: number;
  style: any;
}
function SoftGlow({ size, color, centerOpacity, style }: SoftGlowProps) {
  // Unique id per glow so multiple gradients on the same screen don't collide.
  const id = React.useMemo(
    () => `softglow-${Math.random().toString(36).slice(2, 9)}`,
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

/* ─── Dispersing ripple visual ────────────────────────────────────
 *
 * Concentric rings expanding outward from a central coral dot, each
 * fading as it grows. Visual metaphor: a feeling, named, dissipating
 * outward instead of staying loud. Cleaner than the literal anatomy
 * diagram (loud orb → arrow → quiet orb) and doesn't claim more than
 * the research supports.
 *
 * Implementation: 3 staggered rings, each a Reanimated scale loop with
 * its own delay so they ripple outward in sequence. Driven UI-thread.
 */

function DispersingRipple() {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  useEffect(() => {
    const cfg = { duration: 2800, easing: Easing.out(Easing.cubic) };
    ring1.value = withRepeat(withTiming(1, cfg), -1, false);
    ring2.value = withRepeat(
      withSequence(withTiming(0, { duration: 933 }), withTiming(1, cfg)),
      -1,
      false,
    );
    ring3.value = withRepeat(
      withSequence(withTiming(0, { duration: 1866 }), withTiming(1, cfg)),
      -1,
      false,
    );
  }, [ring1, ring2, ring3]);

  const ringStyle = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      transform: [{ scale: 0.4 + sv.value * 1.4 }],
      opacity: 0.55 - sv.value * 0.55,
    }));

  const r1 = ringStyle(ring1);
  const r2 = ringStyle(ring2);
  const r3 = ringStyle(ring3);

  return (
    <View style={styles.rippleWrap}>
      <Animated.View style={[styles.ringBase, r3]} />
      <Animated.View style={[styles.ringBase, r2]} />
      <Animated.View style={[styles.ringBase, r1]} />
      <View style={styles.rippleCenter} />
    </View>
  );
}

/* ─── Component ─────────────────────────────────────────────────── */

export function DidYouKnow({ topInset, bottomInset, onContinue, onBack }: DidYouKnowProps) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Ambient color fields — soft radial glows, not hard discs. */}
      <SoftGlow
        size={420}
        color={C.coral}
        centerOpacity={0.18}
        style={{ position: 'absolute', top: -160, right: -140 }}
      />
      <SoftGlow
        size={460}
        color={C.lavenderDeep}
        centerOpacity={0.22}
        style={{ position: 'absolute', bottom: -200, left: -160 }}
      />
      <SoftGlow
        size={360}
        color={C.butter}
        centerOpacity={0.09}
        style={{ position: 'absolute', top: '38%', left: -180 }}
      />

      {/* Top bar — back chevron only; the milestone copy moved into the
          body where it gets headline weight. */}
      <View style={[styles.topBar, { paddingTop: topInset + 12 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.85} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}>
          <Glyphs.Back size={18} color={C.cream} />
        </TouchableOpacity>
        <View style={styles.topSide} />
        <View style={styles.topSide} />
      </View>

      {/* Progress (5 of 10) */}
      <View style={styles.progressRow}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressSeg, i < 5 ? styles.progressOn : styles.progressOff]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* DID YOU KNOW kicker */}
        <View style={styles.didYouKnowRow}>
          <Glyphs.Sparkle size={14} color={C.coral} />
          <Text style={styles.didYouKnowText}>DID YOU KNOW</Text>
        </View>

        {/* Milestone headline — promoted from the small top kicker into
            the prominent position above the visual. */}
        <Text style={styles.milestone}>
          Halfway to your{' '}
          <Text style={styles.milestoneItalic}>result</Text>.
        </Text>

        <DispersingRipple />

        {/* Plain-language affect-labeling — same idea (naming feelings
            softens them) stated in practical, relatable terms.
            Demoted to below the visual; reads as a supporting note. */}
        <Text style={styles.fact}>
          You can learn to name what you{'’'}re{' '}
          <Text style={styles.factItalic}>feeling</Text>.
        </Text>

        <Text style={styles.subline}>
          A tight chest? A racing mind? A clenched jaw?
        </Text>
      </ScrollView>

      {/* Pinned footer — mantra sits directly above the coral CTA. */}
      <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]}>
        <Text style={styles.attribution}>“Naming it is enough.”</Text>
        <TouchableOpacity style={styles.cta} onPress={onContinue} activeOpacity={0.9}>
          <Text style={styles.ctaText}>Five more, gently</Text>
          <Glyphs.Arrow size={13} color={C.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.ink, overflow: 'hidden' },

  topBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topSide: { width: 36, height: 36 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row', gap: 3,
    paddingHorizontal: 20, paddingTop: 6,
  },
  progressSeg: { flex: 1, height: 3, borderRadius: 2 },
  progressOn:  { backgroundColor: C.coral },
  progressOff: { backgroundColor: 'rgba(255,255,255,0.15)' },

  scroll: {
    paddingHorizontal: 24,
    paddingTop: 36,
  },

  didYouKnowRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
  },
  didYouKnowText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10, letterSpacing: 2.2,
    color: 'rgba(251,245,238,0.6)',
  },

  /* Milestone (above the visual) and fact (below the visual) share the
   * same large Fraunces-Medium 30/36 sizing — the user explicitly asked
   * for parity. Spacing differs (milestone sits closer to the top, fact
   * is anchored to the visual below it) but typography is identical. */
  milestone: {
    marginTop: 28,
    fontFamily: 'Fraunces-Medium',
    fontSize: 30, lineHeight: 38,
    letterSpacing: -0.4,
    color: C.cream,
    textAlign: 'center',
    maxWidth: 320,
    alignSelf: 'center',
  },
  milestoneItalic: { fontFamily: 'Fraunces-MediumItalic', color: C.coral },

  fact: {
    marginTop: 28,
    fontFamily: 'Fraunces-Medium',
    fontSize: 30, lineHeight: 38,
    letterSpacing: -0.4,
    color: C.cream,
    textAlign: 'center',
    maxWidth: 320,
    alignSelf: 'center',
  },
  factItalic: { fontFamily: 'Fraunces-MediumItalic', color: C.coral },

  /* Dispersing-ripple visual */
  rippleWrap: {
    marginTop: 36,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringBase: {
    position: 'absolute',
    width: 200, height: 200,
    borderRadius: 100,
    borderWidth: 1.2,
    borderColor: C.coral,
  },
  rippleCenter: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.coral,
  },

  subline: {
    marginTop: 28,
    fontFamily: 'Fraunces-Italic',
    fontSize: 14, lineHeight: 20,
    color: 'rgba(251,245,238,0.7)',
    textAlign: 'center',
    maxWidth: 300,
    alignSelf: 'center',
  },

  attribution: {
    marginBottom: 14,
    fontFamily: 'Fraunces-Italic',
    fontSize: 14, letterSpacing: 0.1,
    color: 'rgba(251,245,238,0.7)',
    textAlign: 'center',
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  cta: {
    backgroundColor: C.coral,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
  },
  ctaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15, color: C.ink,
    letterSpacing: 0.2,
  },
});
