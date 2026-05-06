/**
 * SelfMindHome — daily check-in landing screen.
 *
 * 1:1 port of MBHome in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-a.jsx
 *
 * Layout:
 *   • Cream canvas with a soft peach radial glow (top-right)
 *   • Top bar: empty title, Bell glyph on the right
 *   • Greeting block: kicker (day · weather mood) + Fraunces h1 with italic
 *   • Mood block: <MoodPicker> (6 dot creatures, animated bob) until the
 *     user taps; then collapses into <MoodSelectedCard> with timestamp +
 *     italic note + "change" link. Server-backed via moodService.
 *   • Suggested check-in card: ink background, coral start CTA + ghost text
 *   • 2-col grid: sage grounding card · butter journal-prompt card
 *   • Week chart: 7 lavender bars (today coral) with day initials below
 *
 * Reads `firstName` from local onboarding storage for the rotating welcome
 * line. The chips are stateful — tap to select — but currently a visual
 * signal only; selection is not persisted yet.
 *
 * Bottom tab bar is rendered by the parent layout (`SelfMindTabBar`); this
 * component fills the content area above it.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { getOnboardingData } from '@/utils/onboardingStorage';
import MoodPicker from '@/components/mood/MoodPicker';
import MoodSelectedCard from '@/components/mood/MoodSelectedCard';
import SoundSpacesCard from '@/components/home/SoundSpacesCard';
import NowPlayingButton from '@/components/home/NowPlayingButton';
import { type MoodId } from '@/components/mood/MoodDot';
import { addCheckin, fetchCheckins, lastNDays } from '@/services/mood/moodService';
import { pickGreeting } from '@/services/home/greetings';
import {
  pickHomeSuggestions,
  type HomeSuggestion,
} from '@/services/home/homeSuggestions';
import {
  generateHomeNotifications,
  unreadCount,
} from '@/services/notifications/notificationService';
import { recordFeatureUse, recordRouteUse } from '@/services/home/featureUsageService';

/* ─── Soft peach glow (top-right) ─────────────────────────────────── */

function PeachGlow({ size = 320 }: { size?: number }) {
  const id = React.useMemo(
    () => `home-peach-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );
  return (
    <View
      pointerEvents="none"
      style={[
        styles.glowWrap,
        { width: size, height: size, top: 40, right: -120 },
      ]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor={C.peach} stopOpacity={0.6} />
            <Stop offset="55%" stopColor={C.peach} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={C.peach} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/* ─── Day-aware kicker copy ───────────────────────────────────────── */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function timeOfDayMood(): string {
  const h = new Date().getHours();
  if (h < 5) return 'a quiet hour';
  if (h < 11) return 'a soft morning';
  if (h < 14) return 'a slow midday';
  if (h < 17) return 'a steady afternoon';
  if (h < 21) return 'a warm evening';
  return 'a late night';
}

export function greetingByHour(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Late night';
}

function todayDateLabel(): string {
  const now = new Date();
  return `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`;
}

/* ─── Week chart heights (verbatim from design) ───────────────────── */

const WEEK_BARS = [20, 45, 35, 70, 60, 85, 50];
const WEEK_LABELS = ['m', 't', 'w', 't', 'f', 's', 's'];
const WEEK_TODAY_INDEX = 6; // sunday in the design — coral bar
const DEFAULT_SUGGESTIONS: HomeSuggestion[] = [
  {
    id: 'grounding',
    title: '2 min grounding',
    sub: '5-4-3-2-1',
    glyph: 'Leaf',
    swatch: C.sage,
    route: '/grounding',
    kind: 'practice',
  },
  {
    id: 'journal-prompt',
    title: 'Journal prompt',
    sub: 'what did today ask of you?',
    glyph: 'Book',
    swatch: C.butter,
    route: '/journal-prompt',
    kind: 'journal',
  },
];

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function SelfMindHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [homeGreeting, setHomeGreeting] = useState('soft landing');
  /* Today's mood — `null` = not picked yet (picker shows). After a tap
   * the picker collapses into <MoodSelectedCard>. On mount we hydrate
   * from the server so a user opening the app post-checkin lands on
   * the card directly, not on a fresh picker. */
  const [selectedMood, setSelectedMood] = useState<MoodId | null>(null);
  const [moodLoggedAt, setMoodLoggedAt] = useState<string | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<HomeSuggestion[]>(DEFAULT_SUGGESTIONS);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /* Greeting is keyed off the user's display name. Re-load on every
   * Home focus so a name edit on the Profile tab reflects the moment
   * the user comes back. We track the last-rendered name in a ref so
   * a focus that DOESN'T change the name doesn't reroll the random
   * greeting line. */
  const lastGreetingNameRef = useRef<string | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getOnboardingData()
        .then(async (d) => {
          if (cancelled) return;
          const name = d.firstName?.trim() || undefined;
          if (lastGreetingNameRef.current === name) return;
          lastGreetingNameRef.current = name;
          const nextGreeting = await pickGreeting({ name });
          if (!cancelled) setHomeGreeting(nextGreeting);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }, []),
  );

  /* Tracks whether the user has interacted with the picker since
   * mount. Set true on first pick or first "change". Used to gate
   * the hydration effect's late setState — if the user already
   * picked while the network was in-flight, the resolved fetch
   * MUST NOT clobber their fresh choice. Ref instead of state so
   * `handleSelectMood` doesn't need to depend on (and re-bind on)
   * a hydration flag. */
  const userPickedRef = useRef(false);
  const hasFocusedOnceRef = useRef(false);

  const syncTodayMood = useCallback(async (
    options: {
      respectLocalPick: boolean;
      isCancelled?: () => boolean;
    } = { respectLocalPick: true },
  ) => {
    const res = await fetchCheckins();
    if (!res.ok) return;
    if (options.respectLocalPick && userPickedRef.current) return;
    if (options.isCancelled?.()) return;

    const todays = lastNDays(res.data, 1)[0];
    if (todays?.mood) {
      setSelectedMood(todays.mood);
      setMoodLoggedAt(todays.createdAt);
    } else {
      setSelectedMood(null);
      setMoodLoggedAt(undefined);
    }
    void generateHomeNotifications({
      todaysMood: todays?.mood ?? null,
      checkins: res.data,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    pickHomeSuggestions({ mood: selectedMood })
      .then((next) => {
        if (!cancelled) setSuggestions(next);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedMood]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const isInitialFocus = !hasFocusedOnceRef.current;
        hasFocusedOnceRef.current = true;
        await syncTodayMood({
          respectLocalPick: isInitialFocus,
          isCancelled: () => cancelled,
        });
        const count = await unreadCount();
        if (!cancelled) setHasUnreadNotifications(count > 0);
      })()
        .catch(() => {});
      return () => { cancelled = true; };
    }, [syncTodayMood]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncTodayMood({ respectLocalPick: false });
      const count = await unreadCount();
      setHasUnreadNotifications(count > 0);
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }, [syncTodayMood]);

  /* Pick + persist. Optimistic UI: flip the card immediately, fire the
   * server write fire-and-forget. moodService.addCheckin handles the
   * read-modify-write against the existing JSON-blob endpoint and
   * dedupes by date so a same-day re-log overwrites cleanly. */
  const handleSelectMood = useCallback((mood: MoodId) => {
    userPickedRef.current = true;
    const now = new Date().toISOString();
    setSelectedMood(mood);
    setMoodLoggedAt(now);
    void recordFeatureUse({ feature: 'mood', route: '/home' });
    void (async () => {
      await addCheckin({ mood, createdAt: now });
      const updated = await fetchCheckins().catch(() => null);
      await generateHomeNotifications({
        todaysMood: mood,
        checkins: updated?.ok ? updated.data : undefined,
      });
    })();
  }, []);

  const handleChangeMood = useCallback(() => {
    /* Reset to picker. We don't delete the prior server record — the
     * next selection will overwrite the same-date row via the
     * dedupe-by-date logic in addCheckin. If the user closes the
     * app after tapping "change" without re-picking, the server still
     * holds today's prior mood and the next launch will hydrate it.
     * That's intentional: "change" is a precursor to a new pick, not
     * a delete. */
    userPickedRef.current = true; // also blocks any late hydration
    setSelectedMood(null);
    setMoodLoggedAt(undefined);
  }, []);

  const dateLabel = useMemo(todayDateLabel, []);
  const timeMood = useMemo(timeOfDayMood, []);
  const greeting = useMemo(greetingByHour, []);

  const handleStartVoice = useCallback(() => {
    router.push('/call' as any);
  }, [router]);

  const handleTextInstead = useCallback(() => {
    router.push('/chat' as any);
  }, [router]);

  const handleJournalList = useCallback(() => {
    router.push('/journal' as any);
  }, [router]);

  const handleSuggestion = useCallback((suggestion: HomeSuggestion) => {
    void recordRouteUse(suggestion.route);
    if (suggestion.params) {
      router.push({ pathname: suggestion.route, params: suggestion.params } as any);
      return;
    }
    router.push(suggestion.route as any);
  }, [router]);

  const handlePractices = useCallback(() => {
    void recordFeatureUse({ feature: 'practice', route: '/practice' });
    router.push('/practice' as any);
  }, [router]);

  const handleProgress = useCallback(() => {
    void recordFeatureUse({ feature: 'progress', route: '/mood-history' });
    router.push('/mood-history' as any);
  }, [router]);

  const handleWeekly = useCallback(() => {
    void recordFeatureUse({ feature: 'weekly', route: '/weekly' });
    router.push('/weekly' as any);
  }, [router]);

  const handleBell = useCallback(() => {
    router.push('/notifications' as any);
  }, [router]);

  const handleSoundSpaces = useCallback(() => {
    router.push('/spaces' as any);
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Ambient glow behind everything */}
      <PeachGlow />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topSide} />
        <View style={styles.topRightCluster}>
          <NowPlayingButton />
          <TouchableOpacity
            onPress={handleBell}
            style={styles.bellBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Glyphs.Bell size={18} color={C.ink} />
            {hasUnreadNotifications && <View style={styles.bellDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            // Bottom inset accounts for the floating tab bar (~80) +
            // safe-area + breathing room for the last card.
            { paddingBottom: 120 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.ink2} colors={[C.coral]} />
          }
        >
          {/* Greeting */}
          <Text style={styles.dateKicker}>{dateLabel} · {timeMood}</Text>
          <Text style={styles.headline}>
            {greeting}.
          </Text>
          <Text style={styles.homeGreeting}>{homeGreeting}</Text>

          <Text style={styles.moodPrompt}>
            How are you <Text style={styles.moodPromptItalic}>feeling</Text>?
          </Text>

          {/* Mood — picker until tapped, then a confirmation card.
           * The card carries the timestamp + italic note from
           * MOOD_PALETTE. "change" link resets back to the picker. */}
          {selectedMood === null ? (
            <MoodPicker selected={null} onSelect={handleSelectMood} />
          ) : (
            <MoodSelectedCard
              mood={selectedMood}
              loggedAt={moodLoggedAt}
              onChange={handleChangeMood}
            />
          )}

          {/* Suggested check-in (ink card) — generic copy. The headline
           * uses italic emphasis on "feeling" per the design's voice
           * pattern. The supporting line clarifies that the same
           * companion is reachable via either modality (voice or text). */}
          <View style={styles.suggestedCard}>
            <Text style={styles.suggestedKicker}>SUGGESTED · 12 MIN</Text>
            <Text style={styles.suggestedTitle}>
              Ready to talk about how you{'’'}re{' '}
              <Text style={styles.suggestedTitleItalic}>feeling</Text>?
            </Text>
            <Text style={styles.suggestedSub}>
              Your AI companion is here — voice or text, whenever you need it.
            </Text>
            <View style={styles.suggestedActions}>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={handleStartVoice}
                activeOpacity={0.85}
              >
                <Glyphs.Mic size={15} color={C.ink} />
                <Text style={styles.startBtnText}>Start</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.textInsteadBtn}
                onPress={handleTextInstead}
                activeOpacity={0.7}
              >
                <Text style={styles.textInsteadText}>Text instead</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Context-aware rotating suggestions. */}
          <View style={styles.twoCol}>
            {suggestions.map((suggestion) => {
              const Icon = Glyphs[suggestion.glyph];
              return (
                <TouchableOpacity
                  key={suggestion.id}
                  style={[styles.smallCard, { backgroundColor: suggestion.swatch }]}
                  onPress={() => handleSuggestion(suggestion)}
                  activeOpacity={0.9}
                >
                  <Icon size={20} color={C.ink} />
                  <Text style={styles.smallCardTitle}>{suggestion.title}</Text>
                  <Text style={styles.smallCardSub}>{suggestion.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Shortcuts row — entry points to library surfaces */}
          <View style={{ marginTop: 22 }}>
            <Text style={styles.kicker}>your tools</Text>
            <View style={styles.shortcutsRow}>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={handlePractices}
                activeOpacity={0.85}
              >
                <Glyphs.Leaf size={14} color={C.ink} />
                <Text style={styles.shortcutLabel}>Practices</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={handleProgress}
                activeOpacity={0.85}
              >
                <Glyphs.Wave size={14} color={C.ink} />
                <Text style={styles.shortcutLabel}>Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={handleJournalList}
                activeOpacity={0.85}
              >
                <Glyphs.Book size={14} color={C.ink} />
                <Text style={styles.shortcutLabel}>Journal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={handleWeekly}
                activeOpacity={0.85}
              >
                <Glyphs.Moon size={14} color={C.ink} />
                <Text style={styles.shortcutLabel}>Weekly</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sound Spaces — full-width entry tile */}
          <SoundSpacesCard onPress={handleSoundSpaces} />

          {/* Week chart */}
          <View style={{ marginTop: 22 }}>
            <Text style={styles.kicker}>your week</Text>
            <View style={styles.weekCard}>
              {WEEK_BARS.map((h, i) => {
                const today = i === WEEK_TODAY_INDEX;
                return (
                  <View key={i} style={styles.weekCol}>
                    <View
                      style={[
                        styles.weekBar,
                        { height: h, backgroundColor: today ? C.coral : C.lavender },
                      ]}
                    />
                    <Text style={styles.weekLabel}>{WEEK_LABELS[i]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream, overflow: 'hidden' },

  glowWrap: {
    position: 'absolute',
  },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSide: { width: 36, height: 36 },
  topRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.coral,
    borderWidth: 1,
    borderColor: C.paper,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  /* Kicker (mono uppercase) */
  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  dateKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.0,
    color: C.ink3,
  },

  /* Headline */
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 40,
    // Per docs/ANDROID_TEXT_CROPPING_NOTE.md — "Good evening" / "Good morning"
    // descenders ('g') were clipping on Android. fontSize+8 + no padding
    // override fixes it.
    lineHeight: 51,
    letterSpacing: -0.5,
    color: C.ink,
  },
  homeGreeting: {
    marginTop: 8,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.1,
    color: C.ink2,
  },
  moodPrompt: {
    marginTop: 22,
    fontFamily: 'Fraunces-Medium',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.2,
    color: C.ink,
  },
  moodPromptItalic: {
    fontFamily: 'Fraunces-MediumItalic',
  },

  /* Suggested check-in (ink) */
  suggestedCard: {
    marginTop: 20,
    backgroundColor: C.ink,
    borderRadius: RADIUS.card,
    padding: 22,
  },
  suggestedKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9,
    letterSpacing: 2.2,
    color: 'rgba(251,245,238,0.6)',
  },
  suggestedTitle: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 24,
    lineHeight: 35,
    letterSpacing: -0.3,
    color: C.cream,
  },
  suggestedTitleItalic: { fontFamily: 'Fraunces-MediumItalic' },
  /* Soft supporting line below the headline — Fraunces-Text body
   * size, slightly muted cream so it sits as a layer below the
   * headline without competing. */
  suggestedSub: {
    marginTop: 8,
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(251,245,238,0.72)',
    letterSpacing: 0.15,
  },
  suggestedActions: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.coral,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: RADIUS.btn,
  },
  startBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink,
    letterSpacing: 0.1,
  },
  textInsteadBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.btn,
    borderWidth: 1,
    borderColor: 'rgba(251,245,238,0.25)',
  },
  textInsteadText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: C.cream,
    letterSpacing: 0.1,
  },

  /* 2-col grid */
  twoCol: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  smallCard: {
    flex: 1,
    borderRadius: RADIUS.card,
    padding: 18,
  },
  smallCardTitle: {
    marginTop: 16,
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: -0.1,
    color: C.ink,
  },
  smallCardSub: {
    marginTop: 4,
    fontFamily: 'Fraunces-Text',
    fontSize: 11,
    color: C.ink2,
  },

  /* Shortcuts row */
  shortcutsRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.paper,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
  },
  shortcutLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12.5,
    color: C.ink,
    letterSpacing: 0.1,
  },

  /* Week chart */
  weekCard: {
    marginTop: 8,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: RADIUS.card,
    paddingVertical: 20,
    paddingHorizontal: 18,
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  weekBar: {
    width: '100%',
    borderRadius: 6,
  },
  weekLabel: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    color: C.ink3,
    marginTop: 2,
  },
});
