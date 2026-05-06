/**
 * SelfMindPracticeLibrary — practices index ("a shelf of small, kind things").
 *
 * Layout:
 *   - Top bar with back chevron (returns to whatever pushed us here —
 *     usually /home).
 *   - Today's suggested featured card.
 *   - One of the user's saved practices (random, refreshed on every
 *     focus) as a second featured card with a "SAVED" kicker. Hidden
 *     when the user has no saves.
 *   - Three sections grouped by intent. Saved rows get a tiny coral
 *     heart pill on the right edge so the user can see what they've
 *     kept without leaving the index.
 *
 * Persistence: liked practice ids live in AsyncStorage via
 * `services/practice/likedPractices.ts`. Local-only for now —
 * see `docs/BACKEND_GOD_TABLE_ISSUE.md` for why we're not server-syncing
 * yet.
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
import { useRouter, useFocusEffect } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { getLikedPractices } from '@/services/practice/likedPractices';
import {
  markUsed as markPracticeUsed,
  useLikedPractices,
} from '@/services/practice/practiceProfileSync';

/* ─── Catalog ─────────────────────────────────────────────────────── */

interface Practice {
  /** React key — must be unique across the whole list (FEATURED + all
   *  sections). When the same practice appears in two slots (e.g.
   *  Box breath as both today's featured AND in "when anxiety is
   *  loud"), the second slot needs a distinct id like 'box-breath-2'
   *  to avoid React key collisions. */
  id: string;
  /** Canonical persistence key — the id used in the server columns
   *  `practice_liked`, `practice_stats`, `practice_last_used_at`,
   *  `practice_ui_hints`. Defaults to `id` when omitted. Set this
   *  for duplicate-slot entries so liked-state and stats flow into
   *  the SAME row regardless of which slot the user opened from.
   *  Without this, `box-breath-2`'s heart wouldn't fill even if the
   *  user hearted Box breath from the summary screen. */
  persistenceId?: string;
  title: string;
  duration: string;
  swatch: string;
  route: string;
  /** Soft one-liner shown when the practice is the suggested-card hero. */
  hero?: string;
}

/** Resolve a Practice to its canonical persistence key. Use this
 *  whenever crossing into the practiceProfileSync layer (markUsed,
 *  isLiked checks, hooks, etc.). */
function pidOf(p: Practice): string {
  return p.persistenceId ?? p.id;
}

interface Section {
  title: string;
  items: ReadonlyArray<Practice>;
}

const FEATURED: Practice = {
  id: 'box-breath',
  title: 'Box breath · 4 min',
  duration: '4 min',
  swatch: C.coral,
  route: '/box-breath',
  hero: 'a steady reset for the middle of a hard afternoon',
};

const SECTIONS: ReadonlyArray<Section> = [
  {
    title: 'when anxiety is loud',
    items: [
      { id: '5-4-3-2-1',    title: '5-4-3-2-1 grounding', duration: '3 min', swatch: C.sage,     route: '/grounding',     hero: 'find your way back into your body' },
      { id: 'box-breath-2', persistenceId: 'box-breath', title: 'Box breath', duration: '4 min', swatch: C.lavender, route: '/box-breath', hero: 'four counts in, four counts held' },
    ],
  },
  {
    title: 'for scattered focus',
    items: [
      { id: 'brain-dump', title: 'Brain dump',             duration: '6 min', swatch: C.butter, route: '/brain-dump',  hero: 'every tab in your head, on paper' },
    ],
  },
  {
    title: 'for connection',
    items: [
      { id: 'reach-out',   title: 'Reach out, rehearsed', duration: '5 min', swatch: C.lavender, route: '/reach-out',   hero: 'three drafts, in your tone' },
    ],
  },
];

/** Flat lookup so we can resolve a saved id back to its catalog entry.
 *  Keyed by `pidOf(p)` (the canonical persistence key), NOT by `p.id`,
 *  because saved ids in the server columns are persistence ids. When
 *  two entries share a persistenceId (e.g. FEATURED.id='box-breath' and
 *  the duplicate slot's persistenceId='box-breath'), prefer the entry
 *  whose `id === pidOf(p)` — the "canonical-named" slot — so future
 *  surfaces resolving by pid land on the right Practice deterministically.
 *
 *  Side-effect: legacy / unknown persistence ids on the server (e.g. a
 *  pre-fix `'box-breath-2'` left over in `practice_liked`) are NOT in
 *  this map, so consumers that filter through it drop them silently.
 *  This is the read-side reconciliation for orphans without a one-shot
 *  migration. */
const ALL_PRACTICES: ReadonlyArray<Practice> = [
  FEATURED,
  ...SECTIONS.flatMap((s) => s.items),
];
const PRACTICE_BY_PID: Map<string, Practice> = (() => {
  const m = new Map<string, Practice>();
  for (const p of ALL_PRACTICES) {
    const pid = pidOf(p);
    const existing = m.get(pid);
    /* Prefer the canonical-named entry (id === pid) over a duplicate
     * slot. If both exist with id !== pid, last-write-wins. */
    if (!existing || (p.id === pid && existing.id !== pid)) {
      m.set(pid, p);
    }
  }
  return m;
})();

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function SelfMindPracticeLibrary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  /* Liked ids — driven by useLikedPractices() so cross-device updates
   * (e.g. user hearts a practice on another device → refreshProfile
   * lands → cache reseeds) re-render the library immediately,
   * without waiting for a focus event. The legacy useFocusEffect
   * below still runs to drive the savedFeaturedId pick — it just
   * reads the same cache via the async facade. */
  const likedIds = useLikedPractices();

  /* Random pick from the user's saved practices, shown as a second
   * featured card. We only pick when the page focuses (so it doesn't
   * flicker mid-scroll), and we deliberately allow the same id as
   * today's suggested — that's still a useful "you liked this" signal. */
  const [savedFeaturedId, setSavedFeaturedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* Pick the saved-featured id on focus. Reads from the same cache
   * `useLikedPractices()` does (via the async facade), so this stays
   * the single place we re-roll the random pick — we deliberately
   * don't re-roll on every cache emit, only on focus, so the
   * featured card doesn't shuffle mid-scroll. */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const ids = await getLikedPractices();
        if (cancelled) return;
        /* Filter against `pidOf(FEATURED)` (the persistence key) for
         * symmetry with the new model — `id` here is a saved
         * persistence id from the server. Also drop unknown ids
         * (legacy orphans, mistyped data) so the savedFeatured pick
         * never points at a non-existent Practice. */
        const candidates = ids.filter(
          (id) => id !== pidOf(FEATURED) && PRACTICE_BY_PID.has(id),
        );
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          setSavedFeaturedId(pick);
          console.log('[PracticeLibrary] saved-featured pick=' + pick + ' (of ' + candidates.length + ' candidates, ' + ids.length + ' total liked)');
        } else {
          setSavedFeaturedId(null);
          if (ids.length > 0) {
            console.log('[PracticeLibrary] only-saved practice equals today\'s suggested — hiding saved card');
          }
        }
      })();
      return () => { cancelled = true; };
    }, []),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const ids = await getLikedPractices();
      const candidates = ids.filter(
        (id) => id !== pidOf(FEATURED) && PRACTICE_BY_PID.has(id),
      );
      setSavedFeaturedId(
        candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : null,
      );
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }, []);

  const savedFeatured = useMemo<Practice | null>(() => {
    if (!savedFeaturedId) return null;
    return PRACTICE_BY_PID.get(savedFeaturedId) ?? null;
  }, [savedFeaturedId]);

  const handleStart = useCallback((p: Practice) => {
    const pid = pidOf(p);
    console.log('[PracticeLibrary] start practice id=' + p.id + ' (persist=' + pid + ') → ' + p.route);
    /* Stamp last-used BEFORE navigating so the recently-used surface
     * (and any future streak / sort logic) reflects the entry the
     * moment the user lands on the practice screen. Use the canonical
     * persistence id so duplicate slots converge to one row. */
    markPracticeUsed(pid);
    router.push(p.route as any);
  }, [router]);

  const likedSet = useMemo(() => new Set(likedIds), [likedIds]);

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
        <Text style={styles.title}>Practices</Text>
        <View style={{ width: 36 }} />
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.ink2} colors={[C.coral]} />
          }
        >
          <Text style={styles.kicker}>SMALL PRACTICES, NO PERFORMANCE</Text>
          <Text style={styles.headline}>
            A shelf of <Text style={styles.headlineItalic}>small, kind</Text> things.
          </Text>

          {/* Today's suggested */}
          <FeaturedCard
            practice={FEATURED}
            kicker="TODAY · SUGGESTED"
            onStart={handleStart}
          />

          {/* Saved practice — only when the user has at least one */}
          {savedFeatured && (
            <FeaturedCard
              practice={savedFeatured}
              kicker="SAVED · ONE YOU KEPT"
              onStart={handleStart}
              accent="lavender"
            />
          )}

          {SECTIONS.map((s) => (
            <View key={s.title} style={{ marginTop: 22 }}>
              <Text style={styles.kicker}>{s.title.toUpperCase()}</Text>
              <View style={styles.sectionList}>
                {s.items.map((p) => {
                  /* Liked check uses the canonical persistence id, not
                   * the React-key id. Without this, `box-breath-2`
                   * (whose persistenceId is `box-breath`) wouldn't
                   * fill its heart even when `practice_liked`
                   * contains "box-breath". */
                  const isLiked = likedSet.has(pidOf(p));
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.row}
                      onPress={() => handleStart(p)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.rowSwatch, { backgroundColor: p.swatch }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{p.title}</Text>
                        <Text style={styles.rowMeta}>{p.duration}</Text>
                      </View>
                      {isLiked && (
                        /* Bare filled heart — no surrounding pill. The
                         * row's `gap: 14` already separates it from
                         * the chevron; the fill alone is enough. */
                        <Glyphs.HeartFilled size={16} color={C.coral} />
                      )}
                      <Glyphs.Arrow size={14} color={C.ink3} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
}

/* ─── Featured card ───────────────────────────────────────────────── */

function FeaturedCard({
  practice,
  kicker,
  onStart,
  accent,
}: {
  practice: Practice;
  kicker: string;
  onStart: (p: Practice) => void;
  accent?: 'lavender';
}) {
  const bg = accent === 'lavender' ? C.lavender : practice.swatch;
  return (
    <View style={[styles.featured, { backgroundColor: bg }]}>
      <View style={styles.featuredOrb} pointerEvents="none" />
      <Text style={styles.featuredKicker}>{kicker}</Text>
      <Text style={styles.featuredTitle}>{practice.title}</Text>
      {!!practice.hero && <Text style={styles.featuredSub}>{practice.hero}</Text>}
      <TouchableOpacity
        style={styles.featuredBtn}
        onPress={() => onStart(practice)}
        activeOpacity={0.9}
      >
        <Text style={styles.featuredBtnText}>Start</Text>
        <Glyphs.Arrow size={12} color={C.cream} />
      </TouchableOpacity>
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
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.4,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },

  /* Featured card */
  featured: {
    marginTop: 18,
    borderRadius: RADIUS.card,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  featuredOrb: {
    position: 'absolute',
    right: -30, top: -30,
    width: 140, height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  featuredKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: C.ink2,
  },
  featuredTitle: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: C.ink,
  },
  featuredSub: {
    marginTop: 6,
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    lineHeight: 18,
    color: C.ink2,
    maxWidth: 240,
  },
  featuredBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.btn,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featuredBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: C.cream,
    letterSpacing: 0.1,
  },

  /* Section row */
  sectionList: {
    marginTop: 10,
    gap: 8,
  },
  row: {
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowSwatch: {
    width: 36, height: 36, borderRadius: 12,
    flexShrink: 0,
  },
  rowTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    color: C.ink,
  },
  rowMeta: {
    marginTop: 2,
    fontFamily: 'JetBrainsMono',
    fontSize: 10,
    letterSpacing: 0.5,
    color: C.ink3,
  },
});
