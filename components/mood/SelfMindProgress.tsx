/**
 * SelfMindProgress — weekly + monthly progress overview.
 *
 * 1:1 port of MBProgress in mobile-screens-b.jsx, wired to:
 *   - `getEmotionalProfile()` for the five-dimensions card (calm,
 *     clarity, focus, confidence, positivity) — established during
 *     onboarding's analysing screen.
 *   - `fetchCheckins()` for the "showed up N of 7 days" headline and
 *     the 14-day MoodGrid card. (The 30-day numeric trend chart was
 *     removed — categorical "which mood" is what users wanted to see;
 *     a 14-day window stays scannable on a single card.)
 *
 * Data is loaded fresh on every focus so coming back from a check-in
 * surface reflects the latest. While loading, the screen shows
 * placeholder bars so the layout doesn't shift.
 *
 * Dimension labels below intentionally use the EmotionalProfile field
 * names ("Calm / Clarity / Focus / Confidence / Positivity") rather
 * than the design's "Steadiness / Connection / Rest / Clarity" labels.
 * The design's labels were placeholders; the real backed-by-data
 * dimensions are the ones the model produces and the user has already
 * seen on the reading screen — using the same vocabulary keeps the
 * surfaces consistent.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import {
  addCheckin,
  fetchCheckins,
  type MoodCheckin,
} from '@/services/mood/moodService';
import MoodGrid14Days from './MoodGrid14Days';
import { getEmotionalProfile } from '@/utils/emotionalProfileCache';
import type { EmotionalProfile } from '@/services/chat/bedrockService';
import { type MoodId } from './MoodDot';

/* ─── Constants ───────────────────────────────────────────────────── */

type DimKey = 'calm' | 'clarity' | 'focus' | 'confidence' | 'positivity';

const DIMENSIONS: ReadonlyArray<{ key: DimKey; label: string; color: string }> = [
  { key: 'calm',       label: 'Calm',       color: C.coral },
  { key: 'clarity',    label: 'Clarity',    color: C.lavender },
  { key: 'focus',      label: 'Focus',      color: C.sage },
  { key: 'confidence', label: 'Confidence', color: C.butter },
  { key: 'positivity', label: 'Positivity', color: C.peach },
];

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Returns 1-based ISO-week-of-month for the given date. */
function weekOfMonth(d: Date): number {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return Math.ceil((d.getDate() + first.getDay()) / 7);
}

/** "monday-anchored" 7-day window — count distinct days a checkin
 *  was recorded in the current ISO week. */
function showedUpThisWeek(checkins: MoodCheckin[]): number {
  if (!checkins.length) return 0;
  const today = new Date();
  const day = today.getDay(); // 0 sun .. 6 sat
  const offsetToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - offsetToMonday);
  monday.setHours(0, 0, 0, 0);

  const weekKeys = new Set<string>();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekKeys.add(d.toISOString().slice(0, 10));
  }

  const seen = new Set<string>();
  for (const c of checkins) {
    if (weekKeys.has(c.date)) seen.add(c.date);
  }
  return seen.size;
}

function localDayKey(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function SelfMindProgress() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [profile, setProfile] = useState<EmotionalProfile | null>(null);
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      getEmotionalProfile().catch(() => null),
      fetchCheckins().catch(() => ({ ok: false as const, error: 'load failed' })),
    ]);
    setProfile(p ?? null);
    setCheckins(c.ok ? c.data : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    console.log('[Progress] pull-to-refresh');
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const handleQuickMood = useCallback((mood: MoodId) => {
    const now = new Date().toISOString();
    const todayKey = localDayKey();
    setCheckins((current) => {
      const prior = current.find((item) => item.date === todayKey);
      const nextToday: MoodCheckin = {
        ...prior,
        date: todayKey,
        mood,
        createdAt: now,
      };
      return [nextToday, ...current.filter((item) => item.date !== todayKey)];
    });

    void (async () => {
      const saved = await addCheckin({ mood, createdAt: now });
      if (!saved.ok) return;
      setCheckins((current) => [saved.data, ...current.filter((item) => item.date !== saved.data.date)]);
    })();
  }, []);

  /* Header copy */
  const today = useMemo(() => new Date(), []);
  const monthLabel = MONTHS[today.getMonth()];
  const weekLabel = useMemo(() => `${monthLabel} · week ${weekOfMonth(today)}`, [monthLabel, today]);
  const showedUp = useMemo(() => showedUpThisWeek(checkins), [checkins]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Progress</Text>
        <View style={styles.topSide} />
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 120 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.ink2}
              colors={[C.coral]}
              progressBackgroundColor={C.paper}
            />
          }
        >
          <Text style={styles.kicker}>{weekLabel.toUpperCase()}</Text>
          <Text style={styles.headline}>
            You showed up{' '}
            <Text style={styles.headlineItalic}>
              {showedUp} of 7 days
            </Text>
            .
          </Text>
          <Text style={styles.body}>
            That{'’'}s not a streak to protect. It{'’'}s a rhythm you{'’'}re finding.
          </Text>

          {/* Five dimensions */}
          <View style={styles.dimsCard}>
            <Text style={styles.cardKicker}>YOUR FIVE DIMENSIONS</Text>
            <View style={styles.dimsGrid}>
              {DIMENSIONS.map((d) => {
                const v = profile ? Math.round(profile[d.key]) : 0;
                return (
                  <TouchableOpacity
                    key={d.key}
                    style={styles.dimCell}
                    onPress={() => router.push(`/mood-detail?dim=${d.key}` as any)}
                    disabled={!profile}
                    activeOpacity={0.85}
                  >
                    <View style={styles.dimRow}>
                      <Text style={styles.dimLabel}>{d.label}</Text>
                      <Text style={styles.dimValue}>{profile ? v : '—'}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${profile ? v : 0}%`, backgroundColor: d.color },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {!profile && (
              <Text style={styles.dimEmpty}>
                Finish onboarding to see your reading.
              </Text>
            )}
          </View>

          {/* Pattern noticed (uses whatItMeans from the emotional profile) */}
          {!!profile?.whatItMeans && (
            <View style={styles.patternCard}>
              <Text style={[styles.cardKicker, { color: 'rgba(251,245,238,0.6)' }]}>
                PATTERN NOTICED
              </Text>
              <Text style={styles.patternText}>
                {profile.whatItMeans}
              </Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.patternLink}>EXPLORE →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Mood · last 14 days — dot-creature fortnight grid. Sole
           * mood-trend surface on this screen. The 30-day numeric
           * trend chart was removed; categorical signal (which mood)
           * is what users actually want to see, and the 14-day
           * window stays scannable on a single card. */}
          <MoodGrid14Days checkins={checkins} onSelectTodayMood={handleQuickMood} />
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSide: { width: 36, height: 36 },
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

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
  },
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.4,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  body: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    lineHeight: 21,
    color: C.ink2,
    letterSpacing: 0.1,
  },

  /* Dimensions card */
  dimsCard: {
    marginTop: 22,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: RADIUS.card,
    padding: 22,
  },
  cardKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: C.ink3,
  },
  dimsGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 14,
  },
  /* Two columns; the 5th cell falls onto its own row taking full
   * width — visually fine and keeps the data complete. */
  dimCell: { width: '47%' },
  dimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  dimLabel: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: C.ink,
  },
  dimValue: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    color: C.ink3,
  },
  barTrack: {
    marginTop: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26,31,54,0.06)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
  dimEmpty: {
    marginTop: 14,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 12,
    color: C.ink3,
  },

  /* Pattern noticed (ink) */
  patternCard: {
    marginTop: 14,
    backgroundColor: C.ink,
    borderRadius: RADIUS.card,
    padding: 22,
  },
  patternText: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: C.cream,
  },
  patternLink: {
    marginTop: 14,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.coral,
  },

});
