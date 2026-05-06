/**
 * SelfMindBoxBreathSummary — soft landing after a box-breath session.
 *
 * Design follows `rules/page-design.md`:
 *   - Cream base, peach gradient overlay (emotional surface).
 *   - Fraunces serif headline with italic emphasis.
 *   - Kicker prefixed with `— ` em-dash + space.
 *   - SelfMindOrb above the headline (contemplative surface).
 *   - Pinned "Done" CTA outside any scroll. Single primary action.
 *   - Voice rules: no clinical terms, no exclamations, no emoji.
 *
 * Receives `cycles` (completed) and `seconds` (elapsed) as query params.
 * Done → router.replace('/practice') so back-stack stays shallow.
 *
 * Save-this-practice affordance:
 *   - Heart pill above the Done CTA. Tapping toggles liked state for
 *     practice id 'box-breath' (persisted via likedPractices service).
 *   - First-time visitors see a "Liked it? Save it" hint balloon above
 *     the heart with a soft tail pointing down. The balloon bobs gently
 *     to draw the eye, hides the moment the user taps anything (heart
 *     or Done), and never returns.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import SelfMindOrb from '@/components/common/SelfMindOrb';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import {
  setPracticeLiked,
  markSaveHintSeen,
} from '@/services/practice/likedPractices';
import {
  useIsPracticeLiked,
  useHintSeen,
  useCacheSeeded,
} from '@/services/practice/practiceProfileSync';

const PRACTICE_ID = 'box-breath';
const HINT_KEY = 'box-breath-summary-save';

/* ─── Helpers ────────────────────────────────────────────────────── */

function parseIntSafe(v: string | string[] | undefined, fallback = 0): number {
  if (Array.isArray(v)) v = v[0];
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function reflectionFor(cycles: number): { headline: React.ReactNode; sub: string } {
  if (cycles <= 0) {
    return {
      headline: <>You <Text style={styles.headlineItalic}>came back</Text>.</>,
      sub: 'That counts. Sometimes the start is the whole thing.',
    };
  }
  if (cycles < 4) {
    return {
      headline: <>A small <Text style={styles.headlineItalic}>softening</Text>.</>,
      sub: 'A few breaths slower than the world wanted you to be.',
    };
  }
  if (cycles < 9) {
    return {
      headline: <>You <Text style={styles.headlineItalic}>made room</Text>.</>,
      sub: 'A bit of space, returned to you. Carry it gently.',
    };
  }
  if (cycles < 12) {
    return {
      headline: <>Almost <Text style={styles.headlineItalic}>all the way</Text>.</>,
      sub: 'Long enough for the body to remember it can rest.',
    };
  }
  return {
    headline: <>All <Text style={styles.headlineItalic}>twelve</Text>.</>,
    sub: 'Twelve quiet rounds. The kind that stay with you.',
  };
}

/* ─── Save hint balloon ───────────────────────────────────────────── */

function SaveHint({ visible }: { visible: boolean }) {
  const bob = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      fade.value = withTiming(1, { duration: 280 });
      bob.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      fade.value = withTiming(0, { duration: 200 });
    }
  }, [visible, bob, fade]);

  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: bob.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.hintWrap, style]} pointerEvents="none">
      <View style={styles.hintBubble}>
        <Text style={styles.hintText}>
          Liked it? <Text style={styles.hintBold}>Save it.</Text>
        </Text>
      </View>
      {/* Tail pointing down — same fill as the bubble */}
      <View style={styles.hintTail} />
    </Animated.View>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────── */

export default function SelfMindBoxBreathSummary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ cycles?: string; seconds?: string; from?: string }>();
  const fromParam = Array.isArray(params.from) ? params.from[0] : params.from;

  const cycles = parseIntSafe(params.cycles, 0);
  const seconds = parseIntSafe(params.seconds, 0);
  const reflection = useMemo(() => reflectionFor(cycles), [cycles]);

  /* Save state — driven by hooks so cross-device updates re-render
   * the heart without remounting. The hint visibility is local
   * because it has its own lifecycle (auto-dismiss timer + manual
   * dismiss on tap) and can't just track a server flag. */
  const liked = useIsPracticeLiked(PRACTICE_ID);
  const seenHint = useHintSeen(HINT_KEY);
  /* Same cold-mount gate as SavePracticeButton — don't bob the hint
   * until the cache has loaded server state at least once. */
  const cacheSeeded = useCacheSeeded();
  const [hintVisible, setHintVisible] = useState(false);

  /* Heart pop animation when the user toggles save. */
  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  /* Initialise hint visibility from the cached hint flag — only AFTER
   * cache has seeded at least once, otherwise we'd flash the hint on
   * an empty-cache cold mount before server truth lands. Bail if
   * already visible — anti-flicker mirror of SavePracticeButton. */
  useEffect(() => {
    if (!cacheSeeded) return;
    if (seenHint || liked) return;
    if (hintVisible) return;
    setHintVisible(true);
  }, [cacheSeeded, seenHint, liked, hintVisible]);

  const dismissHint = useCallback(() => {
    if (!hintVisible) return;
    setHintVisible(false);
    void markSaveHintSeen(HINT_KEY);
  }, [hintVisible]);

  const handleToggleSave = useCallback(() => {
    const next = !liked;
    /* `setPracticeLiked` updates the cache synchronously; the hook
     * (useIsPracticeLiked) flips on the next render. No local state
     * to keep in sync, no rollback needed (cache is the source of
     * truth; failed PATCH retries internally and reconciles on the
     * next refreshProfile). */
    heartScale.value = withSequence(
      withSpring(1.25, { damping: 6, stiffness: 220 }),
      withSpring(1, { damping: 8, stiffness: 200 }),
    );
    dismissHint();
    void setPracticeLiked(PRACTICE_ID, next);
  }, [liked, heartScale, dismissHint]);

  const handleDone = useCallback(() => {
    dismissHint();
    /* When entered from the crisis page, return to /chat so the
     * crisis modal re-opens via crisisResumeStore. Otherwise the
     * default flow returns to the practice library. */
    if (fromParam === 'crisis') {
      console.log('[BoxBreathSummary] done — back to /chat (crisis flow)');
      router.replace('/chat' as any);
    } else {
      console.log('[BoxBreathSummary] done — back to /practice');
      router.replace('/practice' as any);
    }
  }, [router, dismissHint, fromParam]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.body, {
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
      }]}>
        <View style={styles.orbWrap}>
          <SelfMindOrb size={160} seed={9} />
        </View>

        <View style={styles.reflectionWrap}>
          <Text style={styles.kicker}>— a soft landing</Text>
          <Text style={styles.headline}>{reflection.headline}</Text>
          <Text style={styles.sub}>{reflection.sub}</Text>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{cycles}</Text>
            <Text style={styles.statLabel}>BREATHS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{formatDuration(seconds)}</Text>
            <Text style={styles.statLabel}>WITH YOURSELF</Text>
          </View>
        </View>

        <Text style={styles.prompt}>
          Notice what feels <Text style={styles.promptItalic}>softer</Text>.
        </Text>

        {/* Save affordance + one-time hint */}
        <View style={styles.saveZone}>
          <SaveHint visible={hintVisible} />
          <TouchableOpacity
            style={[styles.saveBtn, liked && styles.saveBtnOn]}
            onPress={handleToggleSave}
            activeOpacity={0.85}
          >
            <Animated.View style={heartStyle}>
              <Glyphs.Heart size={16} color={liked ? C.coral : C.ink2} />
            </Animated.View>
            <Text style={[styles.saveBtnText, liked && styles.saveBtnTextOn]}>
              {liked ? 'Saved to your practices' : 'Save this practice'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={handleDone}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaText}>Done</Text>
          <Glyphs.Arrow size={13} color={C.cream} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
    overflow: 'hidden',
  },

  body: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },

  orbWrap: { alignSelf: 'center', marginTop: 8 },

  reflectionWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
    marginTop: 4,
  },
  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  headline: {
    marginTop: 14,
    fontFamily: 'Fraunces-Medium',
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.4,
    color: C.ink,
    textAlign: 'center',
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  sub: {
    marginTop: 14,
    fontFamily: 'Fraunces-Text',
    fontSize: 14.5,
    lineHeight: 21,
    letterSpacing: 0.15,
    color: C.ink2,
    textAlign: 'center',
    maxWidth: 300,
  },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginHorizontal: 4,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statValue: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.3,
    color: C.ink,
  },
  statLabel: {
    marginTop: 6,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: C.ink3,
  },
  statDivider: { width: 1, height: 36, backgroundColor: C.line },

  prompt: {
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    lineHeight: 20,
    color: C.ink2,
    textAlign: 'center',
    letterSpacing: 0.15,
  },
  promptItalic: { fontFamily: 'Fraunces-Text-Italic' },

  /* Save affordance */
  saveZone: {
    alignItems: 'center',
    position: 'relative',
    paddingTop: 30, // leave room above for the hint balloon
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line2,
  },
  saveBtnOn: {
    backgroundColor: '#FCEBE2', // soft coral wash, no hex elsewhere; this is unique to saved-state
    borderColor: C.coral,
  },
  saveBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13.5,
    color: C.ink,
    letterSpacing: 0.1,
  },
  saveBtnTextOn: {
    color: C.coral,
  },

  /* Hint balloon */
  hintWrap: {
    position: 'absolute',
    bottom: 56, // sits above the save pill, with the tail pointing into it
    alignItems: 'center',
  },
  hintBubble: {
    backgroundColor: C.ink,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  hintText: {
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    color: C.cream,
    letterSpacing: 0.1,
  },
  hintBold: { fontFamily: 'Fraunces-Medium' },
  hintTail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: C.ink,
    alignSelf: 'center',
  },

  /* CTA */
  cta: {
    backgroundColor: C.ink,
    borderRadius: RADIUS.btn,
    paddingVertical: 16,
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
