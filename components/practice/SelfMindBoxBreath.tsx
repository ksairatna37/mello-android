/**
 * SelfMindBoxBreath — 4×4 box-breathing player.
 *
 * Ink canvas with cream text. A continuous animation traces the coral
 * square's perimeter across each 16-second cycle (4s in · 4s hold · 4s
 * out · 4s hold). The orb in the center pulses with the breath. The
 * active phase headline crossfades on every phase change.
 *
 * Lifecycle:
 *   - Resets to cycle 1 / phase 0 on every focus (no resume-on-mount).
 *   - Pause halts the timeline AND captures elapsed time so resume
 *     continues from the exact point of pause (perimeter, phase, cycle
 *     all stay coherent — no abrupt restart).
 *   - End softly → /box-breath-summary with completed cycles + duration.
 *   - Reaching TARGET_CYCLES naturally → same summary route.
 *
 * Why time-based driving instead of withRepeat + setInterval:
 *   v1 used `withRepeat` for the perimeter and a phase-tick interval.
 *   On pause/resume, both reset (cancelAnimation + setInterval cycle
 *   restart), so resume meant a fresh cycle. The fix: derive every
 *   render from `adjustedElapsed = Date.now() - sessionStart - totalPaused`.
 *   That makes pause/resume math trivial — just add the paused
 *   duration to `totalPausedRef`. The perimeter animation is driven
 *   off the same clock via `withTiming` from current value to next
 *   cycle boundary.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import SelfMindOrb from '@/components/common/SelfMindOrb';
import { BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { recordCrisisFlowEvent } from '@/services/chat/liveContextInjection';
import {
  recordSession as recordPracticeSession,
  getStatsSync as getPracticeStatsSync,
  flushPending as flushPendingPracticeWrites,
} from '@/services/practice/practiceProfileSync';

const TARGET_CYCLES = 12;
const PHASE_MS = 4000;
const CYCLE_MS = PHASE_MS * 4;
const TOTAL_MS = TARGET_CYCLES * CYCLE_MS;
const SQUARE_SIDE = 240;
const SQUARE_INSET = 20;
const SQUARE_PERIMETER = (SQUARE_SIDE - SQUARE_INSET * 2) * 4;

type Phase = 'in' | 'hold-in' | 'out' | 'hold-out';
const PHASE_ORDER: ReadonlyArray<Phase> = ['in', 'hold-in', 'out', 'hold-out'];

const PHASE_COPY: Record<Phase, { v: string; em: string; sub: string }> = {
  'in':       { v: 'Breathe', em: 'in',     sub: 'through your nose · 4 counts' },
  'hold-in':  { v: 'Hold',    em: 'gently', sub: 'four counts at the top' },
  'out':      { v: 'Breathe', em: 'out',    sub: 'through your mouth · 4 counts' },
  'hold-out': { v: 'Pause',   em: 'here',   sub: 'four counts at the bottom' },
};

const PHASE_PILL: Record<Phase, string> = {
  'in':       'in · 4',
  'hold-in':  'hold · 4',
  'out':      'out · 4',
  'hold-out': 'hold · 4',
};

const ARect = Animated.createAnimatedComponent(Rect);

export default function SelfMindBoxBreath() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  /* `from=crisis` routes the player + summary back to /chat instead
   * of /practice when the user finishes — preserves the crisis-page
   * resume flow. Any other value (or undefined) falls through to the
   * default /practice landing. */
  const params = useLocalSearchParams<{ from?: string }>();
  const fromParam = Array.isArray(params.from) ? params.from[0] : params.from;

  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [paused, setPaused] = useState(false);

  /* Real-time clock refs. `adjustedElapsed = now - sessionStart - totalPaused`
   * is the single source of truth for everything (cycle, phase, perimeter
   * progress). On pause we mark `pausedAt`; on resume we add the paused
   * duration to `totalPausedRef` and the math just keeps working. */
  const sessionStartRef = useRef<number>(Date.now());
  const pausedAtRef = useRef<number | null>(null);
  const totalPausedRef = useRef<number>(0);
  /* Guards against double-firing navigateToSummary. Two paths can
   * trigger a session end nearly simultaneously: (1) the natural
   * completion effect when cycle hits TARGET_CYCLES+1, and (2)
   * handleEndSoftly invoked by the user. Without this guard the
   * second path would call recordPracticeSession again, double-
   * counting cycles and totalSessions. Set on the first call;
   * never reset — by the time it would matter, the screen has
   * already navigated away. */
  const sessionEndedRef = useRef<boolean>(false);

  /* Animated values — derived, not authoritative. */
  const progress = useSharedValue(0);
  const orbScale = useSharedValue(0.9);
  const labelOpacity = useSharedValue(1);

  const adjustedNow = useCallback(() => Date.now() - totalPausedRef.current, []);

  /* Reset everything on every focus — fresh session, no persisted state. */
  useFocusEffect(
    useCallback(() => {
      console.log('[BoxBreath] focused — fresh session');
      setPhaseIdx(0);
      setCycle(1);
      setPaused(false);
      sessionStartRef.current = Date.now();
      pausedAtRef.current = null;
      totalPausedRef.current = 0;
      progress.value = 0;
      orbScale.value = 0.9;
      labelOpacity.value = 1;
      return () => {
        cancelAnimation(progress);
        cancelAnimation(orbScale);
        cancelAnimation(labelOpacity);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  /* Drive the perimeter animation from real elapsed time.
   * Re-fires on pause/resume; on resume it picks up where we left off
   * because `progress.value` was held in place by cancelAnimation. */
  useEffect(() => {
    if (paused) {
      cancelAnimation(progress);
      return;
    }
    /* Re-derive current cycle progress from the clock — matches whatever
     * we saw at the moment of resume. */
    const elapsed = adjustedNow() - sessionStartRef.current;
    const cycleStart = Math.floor(elapsed / CYCLE_MS) * CYCLE_MS;
    const intoCycle = elapsed - cycleStart;
    const currentProgress = intoCycle / CYCLE_MS;

    progress.value = currentProgress;
    const remaining = CYCLE_MS - intoCycle;

    /* Step 1: finish the current cycle. Step 2 (recursive cycle loop)
     * runs in the JS thread via the phase ticker below — when
     * progress hits 1 the next render kicks off a fresh withTiming via
     * this same effect (since `cycle` changes and triggers a re-run is
     * not how we drive it; instead we just keep chaining). */
    progress.value = withTiming(
      1,
      { duration: remaining, easing: Easing.linear },
      (finished) => {
        'worklet';
        if (!finished) return;
        progress.value = 0;
        progress.value = withTiming(1, { duration: CYCLE_MS, easing: Easing.linear });
      },
    );
  }, [paused, progress, adjustedNow]);

  /* Phase + cycle ticker — derives both from real time, so pause/resume
   * stays in sync. Polls every 200ms; cheap. */
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const elapsed = adjustedNow() - sessionStartRef.current;
      if (elapsed >= TOTAL_MS) {
        setCycle(TARGET_CYCLES + 1); // signals natural completion
        return;
      }
      const newCycle = Math.min(TARGET_CYCLES, Math.floor(elapsed / CYCLE_MS) + 1);
      const newPhase = Math.floor((elapsed % CYCLE_MS) / PHASE_MS);
      setCycle((c) => (c === newCycle ? c : newCycle));
      setPhaseIdx((p) => (p === newPhase ? p : newPhase));

      /* Re-arm perimeter at cycle boundary — the worklet callback in the
       * pause/resume effect already does this, but if its callback was
       * cancelled (by pause), we need to nudge here. Cheap to re-set. */
      const intoCycle = elapsed - Math.floor(elapsed / CYCLE_MS) * CYCLE_MS;
      const expected = intoCycle / CYCLE_MS;
      if (Math.abs(progress.value - expected) > 0.05) {
        progress.value = expected;
        progress.value = withTiming(
          1,
          { duration: CYCLE_MS - intoCycle, easing: Easing.linear },
          (finished) => {
            'worklet';
            if (!finished) return;
            progress.value = 0;
            progress.value = withTiming(1, { duration: CYCLE_MS, easing: Easing.linear });
          },
        );
      }
    }, 200);
    return () => clearInterval(id);
  }, [paused, adjustedNow, progress]);

  /* Pause / resume bookkeeping — track wall-clock time so resume math
   * lines up with the perimeter that we let cancelAnimation freeze. */
  const handleTogglePause = useCallback(() => {
    setPaused((wasPaused) => {
      if (!wasPaused) {
        pausedAtRef.current = Date.now();
      } else if (pausedAtRef.current != null) {
        totalPausedRef.current += Date.now() - pausedAtRef.current;
        pausedAtRef.current = null;
      }
      return !wasPaused;
    });
  }, []);

  /* Crossfade headline + retarget orb on phase change */
  const phase: Phase = PHASE_ORDER[phaseIdx];
  const phaseMeta = PHASE_COPY[phase];
  useEffect(() => {
    labelOpacity.value = withTiming(
      0,
      { duration: 240, easing: Easing.in(Easing.quad) },
      () => {
        'worklet';
        labelOpacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) });
      },
    );
    const target =
      phase === 'in' ? 1.06 :
      phase === 'hold-in' ? 1.06 :
      phase === 'out' ? 0.86 :
      0.86;
    orbScale.value = withTiming(target, { duration: PHASE_MS, easing: Easing.inOut(Easing.sin) });
  }, [phase, labelOpacity, orbScale]);

  /* End handlers */
  const navigateToSummary = useCallback(() => {
    /* One-shot guard. The natural-completion effect AND handleEndSoftly
     * can both reach here in rare timings; the second arrival must
     * not re-record the session. */
    if (sessionEndedRef.current) {
      console.log('[BoxBreath] navigateToSummary called twice — ignoring second');
      return;
    }
    sessionEndedRef.current = true;

    const completed = Math.max(0, Math.min(TARGET_CYCLES, cycle - 1));
    const seconds = Math.round((adjustedNow() - sessionStartRef.current) / 1000);
    console.log('[BoxBreath] end → cycles=' + completed + ' secs=' + seconds + ' from=' + (fromParam ?? '—'));

    /* Persist the session to the practice cache (server-backed). We
     * record EVERY end — including 0-cycle bails — because completion
     * counts and "you barely tried" both live in the same column.
     * Read-modify-write totalCycles since recordSession's auto-bumped
     * `totalSessions` is the only counter we get for free. */
    const prevStats = getPracticeStatsSync('box-breath');
    const prevTotalCycles = typeof prevStats.totalCycles === 'number' ? prevStats.totalCycles : 0;
    recordPracticeSession('box-breath', {
      lastCycles: completed,
      lastSecs: seconds,
      totalCycles: prevTotalCycles + completed,
    });

    /* Pull the PATCH out of the 300ms debounce window — the user is
     * navigating away (potentially closing the app right after a
     * breathing exercise). flushPending fires the timer immediately
     * and the PATCH races the unmount. We don't await: the
     * navigation should not be visibly blocked on the network call;
     * if the app is killed mid-PATCH we still lose, but the window
     * shrinks from 300ms+network to just network. */
    void flushPendingPracticeWrites();

    /* Crisis flow has its own routing rules:
     *   - cycles >= 4 → soft-landing interstitial that takes the user
     *     back to /chat (where the crisis page re-opens via
     *     crisisResumeStore).
     *   - cycles < 4 → user bailed quickly; breath didn't really
     *     happen. Skip the interstitial entirely and replace directly
     *     to /chat so they get back to the resources without friction.
     * Everything else (normal flow / no `from`) goes to the regular
     * summary page. */
    if (fromParam === 'crisis') {
      /* Emit completion to liveContextInjection so the AI's deferred
       * reply on /chat can react to what the user actually did
       * (cycle count + duration), not just "they did box breath". */
      recordCrisisFlowEvent(`completed-box-breath:cycles=${completed},secs=${seconds}`);
      if (completed >= 4) {
        router.replace('/box-breath-crisis-return' as any);
      } else {
        router.replace('/chat' as any);
      }
      return;
    }

    router.replace(`/box-breath-summary?cycles=${completed}&seconds=${seconds}` as any);
  }, [cycle, router, adjustedNow, fromParam]);

  const handleEndSoftly = useCallback(() => {
    setPaused(true);
    navigateToSummary();
  }, [navigateToSummary]);

  /* Natural completion */
  useEffect(() => {
    if (cycle > TARGET_CYCLES) {
      navigateToSummary();
    }
  }, [cycle, navigateToSummary]);

  const animatedStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: SQUARE_PERIMETER * (1 - progress.value),
  }));
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={[styles.body, {
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 28,
      }]}>
        {/* Header — cycle counter + crossfading phase headline */}
        <View style={styles.headerWrap}>
          <Text style={styles.cycleLabel}>BOX BREATH · {Math.min(TARGET_CYCLES, cycle)} OF {TARGET_CYCLES}</Text>
          <Animated.Text style={[styles.headline, labelStyle]}>
            {phaseMeta.v} <Text style={styles.headlineItalic}>{phaseMeta.em}</Text>.
          </Animated.Text>
          <Animated.Text style={[styles.subline, labelStyle]}>{phaseMeta.sub}</Animated.Text>
        </View>

        {/* Animated square + orb */}
        <View style={styles.squareWrap}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${SQUARE_SIDE} ${SQUARE_SIDE}`}>
            <Rect
              x={SQUARE_INSET}
              y={SQUARE_INSET}
              width={SQUARE_SIDE - SQUARE_INSET * 2}
              height={SQUARE_SIDE - SQUARE_INSET * 2}
              rx={22}
              fill="none"
              stroke="rgba(244,169,136,0.18)"
              strokeWidth={1.5}
            />
            <ARect
              x={SQUARE_INSET}
              y={SQUARE_INSET}
              width={SQUARE_SIDE - SQUARE_INSET * 2}
              height={SQUARE_SIDE - SQUARE_INSET * 2}
              rx={22}
              fill="none"
              stroke={C.coral}
              strokeWidth={2.5}
              strokeDasharray={SQUARE_PERIMETER}
              animatedProps={animatedStrokeProps}
              strokeLinecap="round"
              transform={`rotate(-90 ${SQUARE_SIDE / 2} ${SQUARE_SIDE / 2})`}
            />
          </Svg>
          <View style={styles.orbCenter} pointerEvents="none">
            <Animated.View style={orbStyle}>
              <SelfMindOrb size={140} seed={9} />
            </Animated.View>
          </View>
        </View>

        {/* Phase pill row — readable now, active phase highlights coral */}
        <View style={styles.phaseRow}>
          {PHASE_ORDER.map((p, i) => {
            const on = i === phaseIdx;
            return (
              <React.Fragment key={p + i}>
                <Text style={[styles.phaseLabel, on && styles.phaseLabelOn]}>
                  {PHASE_PILL[p]}
                </Text>
                {i < PHASE_ORDER.length - 1 && (
                  <Text style={styles.phaseSep}>·</Text>
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Footer CTAs */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={handleTogglePause}
            activeOpacity={0.7}
          >
            <Text style={styles.btnGhostText}>{paused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleEndSoftly}
            activeOpacity={0.9}
          >
            <Text style={styles.btnPrimaryText}>End softly</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.ink },

  body: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },

  /* Header */
  headerWrap: { alignItems: 'center', paddingTop: 6 },
  cycleLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.55)',
  },
  headline: {
    marginTop: 18,
    fontFamily: 'Fraunces-Medium',
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -0.6,
    color: C.cream,
    textAlign: 'center',
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  subline: {
    marginTop: 12,
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  /* Square + orb */
  squareWrap: {
    width: SQUARE_SIDE,
    height: SQUARE_SIDE,
    alignSelf: 'center',
    position: 'relative',
  },
  orbCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Phase pill row — bigger + more readable than v1 */
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  phaseLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 14,
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.45)',
  },
  phaseLabelOn: {
    color: C.coral,
  },
  phaseSep: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
  },

  /* CTAs */
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  btnGhostText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.1,
  },
  btnPrimary: { backgroundColor: C.coral },
  btnPrimaryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink,
    letterSpacing: 0.1,
  },
});
