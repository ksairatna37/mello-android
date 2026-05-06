/**
 * SelfMindWeekly — Sunday week-summary surface.
 *
 * 1:1 port of MBWeekly in mobile-screens-c.jsx. Lavender canvas with
 * lavender-deep ink. Shows:
 *   • Mon-Sun checkmark grid (showed up: from mood_checkins)
 *   • "What came up most" chips (aggregated from journal entry tags
 *     + voice session emotions; falls back to journal-only when voice
 *     data is sparse)
 *   • "A small line to carry" — first sentence of the most recent
 *     journal entry, attributed back to the user with the day/time.
 *   • "One gentle ask for next week" — static suggestion for now.
 *
 * Reached as a soft prompt on Sundays from Home (TODO link), or
 * directly via /weekly. Hidden from tab bar.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import {
  loadWeeklyReflection,
  type WeeklyReflection,
} from '@/services/weekly/weeklyReflectionService';
import { createWeeklyCheckinReminder } from '@/services/notifications/notificationService';

/* ─── Helpers ─────────────────────────────────────────────────────── */

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const CHIP_COLORS = [C.coral, C.sage, C.butter, C.peach];

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function SelfMindWeekly() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [reflection, setReflection] = useState<WeeklyReflection | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    console.log('[Weekly] loading reflection…');
    const next = await loadWeeklyReflection();
    setReflection(next);
    console.log('[Weekly] loaded — showedUp=' + next.showedUpCount + ' top=' + next.topItems.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    console.log('[Weekly] pull-to-refresh');
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const handleAddSundayCheckin = useCallback(async () => {
    if (!reflection) return;
    await createWeeklyCheckinReminder({ when: reflection.ask.reminderDate });
    Alert.alert('Added', 'I saved that Sunday check-in in your notifications.');
  }, [reflection]);

  const safeReflection = reflection;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar — close (X) on the right, lavender-deep ink */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topSide} />
        <View style={styles.topSide} />
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Close size={18} color={C.lavenderDeep} />
        </TouchableOpacity>
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64} bg={C.lavender}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 80 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.lavenderDeep}
              colors={[C.lavenderDeep]}
              progressBackgroundColor={C.lavender}
            />
          }
        >
          <Text style={styles.kicker}>
            {(safeReflection?.headerLabel ?? 'this week').toUpperCase()}
          </Text>
          <Text style={styles.headline}>
            Your week,{' '}
            <Text style={styles.headlineItalic}>as it felt</Text>.
          </Text>

          {/* Showed up grid */}
          <View style={styles.paperCard}>
            <Text style={styles.cardKicker}>SHOWED UP</Text>
            <View style={styles.weekGrid}>
              {DAY_INITIALS.map((d, i) => (
                <View key={i} style={styles.weekCol}>
                  <View
                    style={[
                      styles.weekCell,
                      safeReflection?.showedUp[i] ? styles.weekCellOn : styles.weekCellOff,
                    ]}
                  >
                    {safeReflection?.showedUp[i] && <Glyphs.Check size={14} color={C.ink} />}
                  </View>
                  <Text style={styles.weekDayLabel}>{d}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.weekCaption}>
              {safeReflection?.showedUpCount ?? 0} of 7 days.{' '}
              <Text style={styles.weekCaptionItalic}>A rhythm, not a streak.</Text>
            </Text>
          </View>

          {/* What came up most */}
          <View style={[styles.paperCard, { marginTop: 12 }]}>
            <Text style={styles.cardKicker}>WHAT CAME UP MOST</Text>
            {safeReflection && safeReflection.topItems.length > 0 ? (
              <View style={styles.chipsRow}>
                {safeReflection.topItems.map((t, i) => (
                  <View
                    key={t.label}
                    style={[
                      styles.chip,
                      { backgroundColor: CHIP_COLORS[i % CHIP_COLORS.length] },
                    ]}
                  >
                    <Text style={styles.chipText}>
                      {t.label} · {t.count}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Nothing has repeated yet. The week is still gathering itself.
              </Text>
            )}
          </View>

          {/* Small line to carry — ink card */}
          {!!safeReflection?.carry && (
            <View style={styles.inkCard}>
              <Text style={styles.inkKicker}>A SMALL LINE TO CARRY</Text>
              <Text style={styles.inkLine}>{`“${safeReflection.carry.line}”`}</Text>
              <Text style={styles.inkAttribution}>{safeReflection.carry.attribution}</Text>
            </View>
          )}

          {/* One gentle ask */}
          <View style={[styles.paperCard, { marginTop: 12 }]}>
            <Text style={styles.cardKicker}>ONE GENTLE ASK FOR NEXT WEEK</Text>
            <Text style={styles.askText}>
              {safeReflection?.ask.text ?? 'A 3-min Sunday afternoon check-in.'}
            </Text>
            <TouchableOpacity
              style={styles.askBtn}
              onPress={handleAddSundayCheckin}
              activeOpacity={0.9}
            >
              <Text style={styles.askBtnText}>
                {safeReflection?.ask.button ?? 'Add to Sundays, 4pm'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.lavender },

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
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.lavenderDeep,
  },
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.3,
    color: C.lavenderDeep,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },

  /* Paper cards (showed up + tags + ask) */
  paperCard: {
    marginTop: 20,
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    padding: 18,
  },
  cardKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: C.ink3,
  },

  /* Showed up grid */
  weekGrid: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 6,
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekCell: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCellOn:  { backgroundColor: C.coral },
  weekCellOff: { backgroundColor: 'rgba(26,31,54,0.08)' },
  weekDayLabel: {
    marginTop: 6,
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    color: C.ink3,
  },
  weekCaption: {
    marginTop: 14,
    fontFamily: 'Fraunces-Medium',
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.05,
    color: C.ink,
  },
  weekCaptionItalic: { fontFamily: 'Fraunces-MediumItalic', color: C.ink3 },

  /* Tag chips */
  chipsRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  chipText: {
    fontFamily: 'Fraunces-Italic',
    fontSize: 14,
    letterSpacing: -0.05,
    color: C.ink,
  },
  emptyText: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13,
    lineHeight: 19,
    color: C.ink3,
  },

  /* Ink card */
  inkCard: {
    marginTop: 12,
    backgroundColor: C.ink,
    borderRadius: RADIUS.card,
    padding: 18,
  },
  inkKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(251,245,238,0.55)',
  },
  inkLine: {
    marginTop: 10,
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.1,
    color: C.cream,
  },
  inkAttribution: {
    marginTop: 10,
    fontFamily: 'JetBrainsMono',
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(251,245,238,0.55)',
  },

  /* Ask */
  askText: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.1,
    color: C.ink,
  },
  askBtn: {
    marginTop: 14,
    backgroundColor: C.lavenderDeep,
    paddingVertical: 14,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.1,
  },
});
