/**
 * SelfMindMoodDetail — single-dimension drilldown from Progress.
 *
 * 1:1 port of MBMoodDetail in mobile-screens-b.jsx. Reached from
 * SelfMindProgress by tapping a dimension card or "EXPLORE →":
 *   router.push(`/mood-detail?dim=<key>`)
 *
 * Wired to:
 *   - emotionalProfileCache → score for the dimension
 *   - moodService.fetchCheckins() → 28-day heatmap of battery levels
 *   - voiceChatService context (TODO when "what's showing up" is wired
 *     to voice_context entries)
 *
 * Heatmap maps each day's battery (0..100) → coral alpha. Today is
 * highlighted at the bottom-right cell. Empty days render at very
 * low alpha so the grid still reads as a grid.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { fetchCheckins, lastNDays, type MoodCheckin } from '@/services/mood/moodService';
import { getEmotionalProfile } from '@/utils/emotionalProfileCache';
import type { EmotionalProfile } from '@/services/chat/bedrockService';

/* ─── Constants ───────────────────────────────────────────────────── */

type DimKey = 'calm' | 'clarity' | 'focus' | 'confidence' | 'positivity';

interface DimMeta {
  key: DimKey;
  label: string;
  /** Soft observation copy for the headline italic. */
  observationItalic: string;
  /** Default headline framed around this dimension. */
  headline: string;
}

const DIM_META: Record<DimKey, DimMeta> = {
  calm: {
    key: 'calm',
    label: 'Calm',
    observationItalic: 'you realize',
    headline: 'Sundays ask more of you than',
  },
  clarity: {
    key: 'clarity',
    label: 'Clarity',
    observationItalic: 'naming it',
    headline: 'You see things more clearly the moment you start',
  },
  focus: {
    key: 'focus',
    label: 'Focus',
    observationItalic: 'returning',
    headline: 'Your focus isn’t broken — it’s just',
  },
  confidence: {
    key: 'confidence',
    label: 'Confidence',
    observationItalic: 'you do',
    headline: 'You trust yourself more in the small choices than',
  },
  positivity: {
    key: 'positivity',
    label: 'Positivity',
    observationItalic: 'small ways',
    headline: 'There’s warmth in your week, in',
  },
};

const DAY_LABELS = ['m', 't', 'w', 't', 'f', 's', 's'];

/* ─── Helpers ─────────────────────────────────────────────────────── */

/** Map battery 0..100 → coral alpha (0.1..1.0); empty days → 0.1. */
function batteryToAlpha(b: number | null | undefined): number {
  if (b == null) return 0.1;
  const c = Math.max(0, Math.min(100, b));
  return 0.15 + (c / 100) * 0.85;
}

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function SelfMindMoodDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ dim?: string }>();

  const dimKey: DimKey = useMemo(() => {
    const v = typeof params.dim === 'string' ? params.dim.toLowerCase() : 'calm';
    return ['calm', 'clarity', 'focus', 'confidence', 'positivity'].includes(v)
      ? (v as DimKey)
      : 'calm';
  }, [params.dim]);

  const meta = DIM_META[dimKey];

  const [profile, setProfile] = useState<EmotionalProfile | null>(null);
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);

  const load = useCallback(async () => {
    console.log('[MoodDetail] loading dim=' + dimKey);
    const [p, c] = await Promise.all([
      getEmotionalProfile().catch(() => null),
      fetchCheckins().catch(() => ({ ok: false as const, error: 'load failed' })),
    ]);
    setProfile(p ?? null);
    setCheckins(c.ok ? c.data : []);
    console.log(
      '[MoodDetail] loaded — profileScore=' + (p ? p[dimKey] : 'n/a'),
      'checkins=' + (c.ok ? c.data.length : 0),
    );
  }, [dimKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /* 28-day heatmap data — lastNDays returns a chronological window. */
  const heatmap = useMemo(() => lastNDays(checkins, 28), [checkins]);

  const score = profile ? Math.round(profile[dimKey]) : null;

  const handleAddSuggestion = useCallback(() => {
    Alert.alert(
      'Coming soon',
      'Scheduled check-ins aren’t yet wired to notifications — try this manually for now.',
    );
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{meta.label}</Text>
        <TouchableOpacity
          onPress={() => console.log('[MoodDetail] more tapped')}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.More size={18} color={C.ink} />
        </TouchableOpacity>
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 80 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>A CLOSER LOOK</Text>
          <Text style={styles.headline}>
            {meta.headline}{' '}
            <Text style={styles.headlineItalic}>{meta.observationItalic}</Text>.
          </Text>

          {/* Score readout */}
          {score !== null && (
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Current</Text>
              <Text style={styles.scoreValue}>{score}</Text>
              <Text style={styles.scoreSlash}>/ 100</Text>
            </View>
          )}

          {/* 28-day heatmap */}
          <View style={styles.heatCard}>
            <View style={styles.heatGrid}>
              {heatmap.map((d, i) => (
                <View
                  key={i}
                  style={[
                    styles.heatCell,
                    { backgroundColor: `rgba(244, 169, 136, ${batteryToAlpha(d?.battery)})` },
                    i === heatmap.length - 1 && styles.heatCellToday,
                  ]}
                />
              ))}
            </View>
            <View style={styles.heatLabels}>
              {DAY_LABELS.map((l, i) => (
                <Text
                  key={i}
                  style={[
                    styles.heatLabel,
                    i === DAY_LABELS.length - 1 && { color: C.coral },
                  ]}
                >
                  {l}
                </Text>
              ))}
            </View>
          </View>

          {/* Patterns lavender card — currently a static "what's showing up"
              list seeded with reasonable defaults. Real wiring lands when
              voice_context is queried per-dimension. */}
          <View style={styles.patternCard}>
            <Text style={[styles.cardKicker, { color: C.lavenderDeep }]}>
              WHAT{'’'}S SHOWING UP THIS MONTH
            </Text>
            <View style={styles.patternList}>
              {DEFAULT_PATTERNS[dimKey].map((p) => (
                <View key={p} style={styles.patternRow}>
                  <Text style={styles.patternText}>{p}</Text>
                  <Glyphs.Arrow size={12} color={C.lavenderDeep} />
                </View>
              ))}
            </View>
          </View>

          {/* Sage suggestion */}
          <View style={styles.suggestCard}>
            <Text style={styles.cardKicker}>SOMETHING TO TRY</Text>
            <Text style={styles.suggestText}>
              {DEFAULT_SUGGESTIONS[dimKey]}
            </Text>
            <TouchableOpacity
              style={styles.suggestBtn}
              onPress={handleAddSuggestion}
              activeOpacity={0.9}
            >
              <Text style={styles.suggestBtnText}>Add to my week</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
}

/* ─── Defaults ────────────────────────────────────────────────────── */

const DEFAULT_PATTERNS: Record<DimKey, ReadonlyArray<string>> = {
  calm: ['family · 8 mentions', 'bracing · 6 mentions', 'the anticipatory tax · 4 mentions', 'performing fine · 3 mentions'],
  clarity: ['naming a feeling · 7 mentions', 'making space · 5 mentions', 'second-guessing · 3 mentions'],
  focus: ['fragmentation · 6 mentions', 'one-thing-at-a-time · 4 mentions', 'returning to it · 3 mentions'],
  confidence: ['quiet competence · 5 mentions', 'small wins · 4 mentions', 'taking up space · 3 mentions'],
  positivity: ['small joys · 6 mentions', 'gratitude · 4 mentions', 'easing up · 3 mentions'],
};

const DEFAULT_SUGGESTIONS: Record<DimKey, string> = {
  calm: 'A 3-min Sunday afternoon check-in — catch the bracing before it catches you.',
  clarity: 'A 2-min "name what it is" practice on the next foggy day.',
  focus: 'A 4-min reset breath when you notice the thread slipping.',
  confidence: 'A nightly "one thing I didn’t over-explain" note.',
  positivity: 'Three small noticings before bed — texture, light, or sound.',
};

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream2 },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.3,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },

  scoreRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  scoreLabel: {
    fontFamily: 'JetBrainsMono',
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 28,
    lineHeight: 36,
    color: C.ink,
    letterSpacing: -0.2,
  },
  scoreSlash: {
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    color: C.ink3,
  },

  /* Heatmap card */
  heatCard: {
    marginTop: 22,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: RADIUS.card,
    padding: 20,
  },
  heatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%',
  },
  heatCell: {
    width: `${(100 - 6 * 6) / 7}%`,
    aspectRatio: 1,
    borderRadius: 7,
  },
  heatCellToday: {
    borderWidth: 2,
    borderColor: C.coral,
  },
  heatLabels: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  heatLabel: {
    flex: 1,
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    color: C.ink3,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  /* Pattern lavender card */
  patternCard: {
    marginTop: 14,
    backgroundColor: C.lavender,
    borderRadius: RADIUS.card,
    padding: 18,
  },
  cardKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: C.ink3,
  },
  patternList: {
    marginTop: 12,
    gap: 10,
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  patternText: {
    flex: 1,
    fontFamily: 'Fraunces-Italic',
    fontSize: 13,
    letterSpacing: 0.05,
    color: C.ink,
  },

  /* Sage suggestion */
  suggestCard: {
    marginTop: 14,
    backgroundColor: C.sage,
    borderRadius: RADIUS.card,
    padding: 18,
  },
  suggestText: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.1,
    color: C.ink,
  },
  suggestBtn: {
    marginTop: 14,
    backgroundColor: C.ink,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: RADIUS.btn,
    alignSelf: 'flex-start',
  },
  suggestBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.1,
  },
});
