/**
 * SelfMindGrounding — 5-4-3-2-1 grounding practice.
 *
 * 1:1 port of MBGrounding in mobile-screens-c.jsx. Cream canvas, top
 * bar with timer, kicker "5 · 4 · 3 · 2 · 1", italic-on-{senseCount}
 * headline. Five steps stacked vertically with state (done / active /
 * idle). User taps "I named N" → advance to next step, or back to
 * /practice when complete.
 *
 * No AI / no backend persistence — it's a self-contained practice.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import SavePracticeButton from './SavePracticeButton';

interface Step {
  count: number;
  sense: string;
  swatch: string;
  /** Word in italic in the headline ("name *four things* you can feel") */
  italicWord: string;
}

const STEPS: ReadonlyArray<Step> = [
  { count: 5, sense: 'things you can see',  swatch: C.peach,    italicWord: 'five things' },
  { count: 4, sense: 'things you can feel', swatch: C.lavender, italicWord: 'four things' },
  { count: 3, sense: 'things you can hear', swatch: C.sage,     italicWord: 'three things' },
  { count: 2, sense: 'things you can smell',swatch: C.butter,   italicWord: 'two things' },
  { count: 1, sense: 'thing you can taste', swatch: C.coral,    italicWord: 'one thing' },
];

export default function SelfMindGrounding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeIdx, setActiveIdx] = useState(0);

  const current = STEPS[activeIdx];
  const verb = activeIdx === 1 ? 'feel' : activeIdx === 2 ? 'hear' : activeIdx === 3 ? 'smell' : activeIdx === 4 ? 'taste' : 'see';

  const handleAdvance = useCallback(() => {
    console.log('[Grounding] step ' + (activeIdx + 1) + ' done');
    if (activeIdx >= STEPS.length - 1) {
      console.log('[Grounding] complete — going back');
      router.replace('/practice' as any);
      return;
    }
    setActiveIdx((i) => i + 1);
  }, [activeIdx, router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar — back chevron + timer (right) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.replace('/practice' as any)}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Grounding</Text>
        <SavePracticeButton practiceId="5-4-3-2-1" />
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 120 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>5 · 4 · 3 · 2 · 1</Text>
          <Text style={styles.headline}>
            Name <Text style={styles.headlineItalic}>{current.italicWord}</Text> you can {verb}.
          </Text>
          <Text style={styles.body}>
            The chair under you. Fabric at your wrist. The floor through your socks. Air on your cheek. Out loud or in your head.
          </Text>

          <View style={styles.stepList}>
            {STEPS.map((s, i) => {
              const isDone = i < activeIdx;
              const isActive = i === activeIdx;
              return (
                <View
                  key={s.count}
                  style={[
                    styles.stepRow,
                    isActive && [styles.stepRowActive, { backgroundColor: s.swatch }],
                    isDone && styles.stepRowDone,
                  ]}
                >
                  <View
                    style={[
                      styles.stepBadge,
                      isDone && styles.stepBadgeDone,
                    ]}
                  >
                    {isDone ? (
                      <Glyphs.Check size={14} color={C.cream} />
                    ) : (
                      <Text style={styles.stepBadgeText}>{s.count}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      isDone && styles.stepTextDone,
                    ]}
                  >
                    {s.count} {s.sense}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </FadingScrollWrapper>

      {/* Pinned CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.cta}
          onPress={handleAdvance}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaText}>
            {activeIdx >= STEPS.length - 1 ? 'I named one' : `I named ${current.count}`}
          </Text>
          <Glyphs.Arrow size={13} color={C.cream} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10, elevation: 10,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    color: C.ink,
    letterSpacing: -0.1,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
  },
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.3,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  body: {
    marginTop: 12,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5,
    lineHeight: 21,
    color: C.ink2,
    letterSpacing: 0.1,
  },

  stepList: {
    marginTop: 22,
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
  },
  stepRowActive: {
    borderWidth: 2,
    borderColor: C.ink,
  },
  stepRowDone: {
    backgroundColor: 'rgba(26,31,54,0.04)',
    opacity: 0.55,
  },
  stepBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeDone: {
    backgroundColor: C.ink,
    borderColor: 'transparent',
  },
  stepBadgeText: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 18,
    lineHeight: 24,
    color: C.ink,
  },
  stepText: {
    flex: 1,
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    color: C.ink,
  },
  stepTextDone: {
    textDecorationLine: 'line-through',
    color: C.ink3,
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  cta: {
    backgroundColor: C.ink,
    paddingVertical: 16,
    borderRadius: RADIUS.btn,
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
