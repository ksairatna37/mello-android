/**
 * MoodGrid14Days — last-fortnight overview as a 7×2 dot-creature grid.
 *
 * Sits above the 30-day trend chart on `SelfMindProgress.tsx`. Reads
 * the same `MoodCheckin[]` source the chart does. Each cell renders:
 *
 *   - The day's MoodDot (small, not animated to keep the grid calm) if
 *     a mood was logged that day, OR an outline ghost dot otherwise.
 *   - A single-letter day label below (m / t / w / ...).
 *   - Today's cell sits inside a coral wash so "where you are now"
 *     reads at a glance against the prior thirteen days.
 *
 * Footer line summarises the fortnight: the most-frequently logged
 * mood, framed as "{label} showed up most this fortnight." On ties we
 * prefer the MOST RECENT occurrence (the user's likely current state)
 * over alphabetical or insertion order. Footer hidden when there's
 * fewer than ~3 days of data — not enough signal for a "most" claim
 * on a mental-health surface.
 *
 * Layout & voice per page-design.md: BRAND tokens only, lowercase
 * Fraunces italic emphasis, no emoji.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
  type GestureResponderEvent,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import MoodDot, { MOOD_KEYS, MOOD_PALETTE, type MoodId } from './MoodDot';
import { lastNDays, type MoodCheckin } from '@/services/mood/moodService';

interface MoodGrid14DaysProps {
  /** All known checkins (newest first or any order — `lastNDays`
   *  rebuilds an ordered window internally). */
  checkins: ReadonlyArray<MoodCheckin>;
  /** Optional quick logger for today's highlighted cell. */
  onSelectTodayMood?: (mood: MoodId) => void;
}

/** Window length. 14 = two weeks, matches the design's 7×2 grid. */
const WINDOW_DAYS = 14;
/** Cell dimensions (dp). 7 × CELL_W must fit inside the card's content
 *  width on the smallest target device (iPhone SE 1st-gen ≈ 320dp,
 *  card padding 14×2 + screen padding ≈ 24×2 = 76dp → 244dp content).
 *  CELL_W=36 → 7×36 = 252dp; pair with `flex: 1` cells so they
 *  shrink to fit on truly narrow widths instead of overflowing. */
const CELL_DOT = 28;
const CELL_W = 36;
const REACTION_RAIL_W = 52;
const REACTION_RAIL_H = 5 * 46 + 10;
/** Long day names for accessibility labels. */
const DAY_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
/** Month names for accessibility labels. */
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Day labels, oldest → newest. Indexed off the cell's offset from
 *  today (0 = today, 13 = 13 days ago). */
const DAY_INITIALS = ['s', 'm', 't', 'w', 't', 'f', 's'];

const MoodGrid14Days: React.FC<MoodGrid14DaysProps> = ({ checkins, onSelectTodayMood }) => {
  const { width: windowWidth } = useWindowDimensions();
  /* `lastNDays` returns oldest → newest (today last) with `null` for
   * days with no checkin. Perfect input for the grid.
   *
   * `useMemo([checkins])` is correct here because the parent
   * (SelfMindProgress) holds checkins in `useState` and only re-sets
   * via `fetchCheckins`. The reference is stable between fetches; the
   * memo only recomputes when new data lands. If a future caller
   * recreates the array on every render, this still works (memo is
   * cheap, lastNDays is O(14)) — just slightly redundant. */
  const windowSlice = useMemo(
    () => lastNDays([...checkins], WINDOW_DAYS),
    [checkins],
  );

  /* Two rows of 7. First row = days 13..7 ago, second row = days 6
   * ago..today. The grid reads top-to-bottom, left-to-right. */
  const row1 = windowSlice.slice(0, 7);
  const row2 = windowSlice.slice(7, WINDOW_DAYS);

  /* "Today" needs to advance across midnight when the user leaves the
   * Progress screen open. Driven by AppState: every foreground event
   * re-stamps `today`. Cheap; no setInterval needed (a user who
   * physically watches the screen across midnight without backgrounding
   * is rare; if they do, the next foreground refreshes it). */
  const [today, setToday] = useState<Date>(() => new Date());
  const [reactionOpen, setReactionOpen] = useState(false);
  const [reactionAnchor, setReactionAnchor] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      /* Only setState when the calendar day actually changed —
       * otherwise every foreground triggers a wasted re-render. */
      setToday((prev) => (
        prev.getDate() === now.getDate() &&
        prev.getMonth() === now.getMonth() &&
        prev.getFullYear() === now.getFullYear()
          ? prev
          : now
      ));
    };
    const handleStateChange = (next: AppStateStatus) => {
      if (next === 'active') refresh();
    };
    const sub = AppState.addEventListener('change', handleStateChange);
    return () => sub.remove();
  }, []);

  /* Build day-letter labels matching each row's calendar dates. */
  const todayDow = today.getDay();
  const labels = useMemo(() => {
    const out: string[] = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
      /* Canonical safe-mod: ((a - b) % n + n) % n. Avoids the magic
       * `+ 7 * 2` constant and works for any window length. */
      const dow = (((todayDow - i) % 7) + 7) % 7;
      out.push(DAY_INITIALS[dow]);
    }
    return out;
  }, [todayDow]);

  /* Build accessibility-label dates matching each cell. */
  const cellDates = useMemo(() => {
    const out: Date[] = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(d);
    }
    return out;
  }, [today]);

  /* Footer: most-frequent mood — only when there's a TRUE plurality.
   * Mental-health surface; falsely framing a 1-1-1 spread as a
   * "dominant pattern" is misleading. Gate:
   *   1. At least 3 days logged (signal floor).
   *   2. Winner has n >= 2 (so a single occurrence isn't framed as "most").
   *   3. Winner has n > runner-up's n (no ties — if we can't tell, we don't claim).
   * Tie-break inside the winner search by most-recent occurrence is
   * still applied, but only as a stable ordering — gating happens
   * after via the runner-up check. */
  const summary = useMemo(() => {
    const counts = new Map<MoodId, { n: number; lastIdx: number }>();
    windowSlice.forEach((c, i) => {
      if (!c?.mood) return;
      const prev = counts.get(c.mood);
      counts.set(c.mood, {
        n: (prev?.n ?? 0) + 1,
        lastIdx: i, // higher idx = more recent (window is oldest→newest)
      });
    });
    if (counts.size === 0) return null;
    const totalLogged = windowSlice.reduce((acc, c) => acc + (c?.mood ? 1 : 0), 0);
    if (totalLogged < 3) return null;

    /* Find top two by count, tie-break by most-recent. */
    let first: { mood: MoodId; n: number; lastIdx: number } | null = null;
    let second: { mood: MoodId; n: number } | null = null;
    for (const [mood, stat] of counts) {
      if (
        !first ||
        stat.n > first.n ||
        (stat.n === first.n && stat.lastIdx > first.lastIdx)
      ) {
        if (first) second = { mood: first.mood, n: first.n };
        first = { mood, n: stat.n, lastIdx: stat.lastIdx };
      } else if (!second || stat.n > second.n) {
        second = { mood, n: stat.n };
      }
    }
    if (!first || first.n < 2) return null; // single-occurrence isn't "most"
    if (second && second.n >= first.n) return null; // tie — don't claim a winner
    return first.mood;
  }, [windowSlice]);

  const handleToggleTodayReactions = useCallback((event?: GestureResponderEvent) => {
    if (!onSelectTodayMood) return;
    if (event) {
      setReactionAnchor({
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      });
    }
    setReactionOpen((open) => !open);
  }, [onSelectTodayMood]);

  const handleSelectTodayMood = useCallback((mood: MoodId) => {
    onSelectTodayMood?.(mood);
    setReactionOpen(false);
  }, [onSelectTodayMood]);

  const railPosition = reactionAnchor
    ? {
        left: Math.min(
          windowWidth - REACTION_RAIL_W - 12,
          Math.max(12, reactionAnchor.x - REACTION_RAIL_W + 22),
        ),
        top: Math.max(12, reactionAnchor.y - REACTION_RAIL_H - 10),
      }
    : undefined;

  return (
    <View style={{ marginTop: 22 }}>
      <Text style={styles.kicker}>MOOD · LAST 14 DAYS</Text>
      <View style={styles.card}>
        <View style={styles.row} accessibilityRole="list">
          {row1.map((c, i) => (
            <Cell
              key={`r1-${i}`}
              mood={c?.mood ?? null}
              label={labels[i]}
              date={cellDates[i]}
              isToday={false}
            />
          ))}
        </View>
        <View style={styles.row} accessibilityRole="list">
          {row2.map((c, i) => (
            <Cell
              key={`r2-${i}`}
              mood={c?.mood ?? null}
              label={labels[i + 7]}
              date={cellDates[i + 7]}
              /* Today is the LAST cell of row 2. */
              isToday={i === 6}
              onToggleTodayReactions={i === 6 ? handleToggleTodayReactions : undefined}
            />
          ))}
        </View>

        {summary && (
          <Text style={styles.footer}>
            <Text style={styles.footerItalic}>{MOOD_PALETTE[summary].label}</Text>{' '}
            showed up most this fortnight.
          </Text>
        )}
      </View>

      <View style={styles.reactionPrewarm} pointerEvents="none">
        <ReactionRail onSelectMood={() => {}} />
      </View>

      <Modal
        visible={reactionOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setReactionOpen(false)}
      >
        <Pressable
          style={styles.reactionBackdrop}
          onPress={() => setReactionOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="dismiss mood reactions"
        >
          <View style={[styles.reactionRail, railPosition ?? styles.reactionRailFallback]} pointerEvents="box-none">
            <ReactionRail onSelectMood={handleSelectTodayMood} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export default MoodGrid14Days;

interface CellProps {
  mood: MoodId | null;
  label: string;
  date: Date;
  isToday: boolean;
  onToggleTodayReactions?: (event: GestureResponderEvent) => void;
}

/** Single grid cell. Renders an outline ghost dot for empty days so
 *  the grid keeps a steady rhythm; renders the colored MoodDot for
 *  logged days; wraps today's cell in a coral wash.
 *
 *  Accessibility: each cell announces "Tuesday April 22, good" or
 *  "Tuesday April 22, no entry" so screen-reader users can scan the
 *  fortnight without a sighted layout. */
const Cell: React.FC<CellProps> = ({
  mood,
  label,
  date,
  isToday,
  onToggleTodayReactions,
}) => {
  const dayName = DAY_FULL[date.getDay()];
  const monthName = MONTH_NAMES[date.getMonth()];
  const moodLabel = mood ? MOOD_PALETTE[mood].label : 'no entry';
  const a11yLabel = `${dayName} ${monthName} ${date.getDate()}, ${moodLabel}` + (isToday ? ', today' : '');
  const canQuickLog = isToday && !!onToggleTodayReactions;
  const CellRoot = canQuickLog ? Pressable : View;

  return (
    <CellRoot
      style={styles.cell}
      accessible
      accessibilityRole={canQuickLog ? 'button' : 'text'}
      accessibilityLabel={a11yLabel}
      accessibilityHint={canQuickLog ? 'opens quick mood reactions' : undefined}
      onPress={canQuickLog ? onToggleTodayReactions : undefined}
    >
      <View style={[styles.dotWrap, isToday && styles.dotWrapToday]}>
        {mood ? (
          /* Static — animated bobs would be overwhelming across 14 cells. */
          <View style={styles.moodDotSlot}>
            <MoodDot mood={mood} size={CELL_DOT} animated={false} />
          </View>
        ) : (
          <GhostDot size={CELL_DOT} />
        )}
      </View>
      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
        {label}
      </Text>
    </CellRoot>
  );
};

const ReactionRail: React.FC<{ onSelectMood: (mood: MoodId) => void }> = ({ onSelectMood }) => (
  <>
    {MOOD_KEYS.map((moodKey) => (
      <Pressable
        key={moodKey}
        onPress={() => onSelectMood(moodKey)}
        style={({ pressed }) => [
          styles.reactionButton,
          pressed && styles.reactionButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`log ${MOOD_PALETTE[moodKey].label} for today`}
      >
        <MoodDot mood={moodKey} size={34} animated={false} />
      </Pressable>
    ))}
  </>
);

/** Outline-only placeholder for days with no checkin. Matches the
 *  MoodDot's body geometry (r=70 in viewBox 200×260) so the empty
 *  cells visually align with the filled ones. Stroke + dash sized
 *  in viewBox units to render at ~1.5dp on screen at any cell size,
 *  matching MoodDot's size-aware stroke logic. */
const GhostDot: React.FC<{ size: number }> = ({ size }) => {
  const sw = Math.max(2.2, (1.5 * 200) / size);
  /* Dash length scales with stroke so the dotted feel stays
   * proportional — too tight at small dashes blurs into a solid line. */
  const dash = `${sw * 2} ${sw * 2}`;
  return (
    <View style={{ width: size, height: size * 1.3 }}>
      <Svg width={size} height={size * 1.3} viewBox="0 0 200 260">
        {/* r=78 matches MoodDot's scaled-up body so empty cells line
         * up with filled ones at the same diameter. */}
        <Circle
          cx={100}
          cy={100}
          r={78}
          fill="none"
          stroke={C.line2}
          strokeWidth={sw}
          strokeDasharray={dash}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  card: {
    marginTop: 10,
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  cell: {
    /* flex: 1 inside a 7-cell row → cells share available width
     * evenly. 320dp phones don't overflow; 430dp+ phones get a roomier
     * grid. No fixed width — `MoodDot` is intrinsically sized at
     * CELL_DOT (28) and centers within the cell. */
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  dotWrap: {
    /* Coral wash on today's cell — soft pill that hugs the dot.
     * Padding kept small so even narrow flex cells don't clip the
     * pill bg on smallest devices. */
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  moodDotSlot: {
    width: CELL_DOT,
    height: CELL_DOT * 1.3,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dotWrapToday: {
    /* Translucent coral wash — defined as `BRAND.coralWash` so this
     * highlight stays in sync with any future re-tint of coral. */
    backgroundColor: C.coralWash,
  },
  reactionRail: {
    position: 'absolute',
    width: REACTION_RAIL_W,
    zIndex: 20,
    elevation: 8,
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 22,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: C.ink,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    gap: 4,
  },
  reactionRailFallback: {
    right: 12,
    bottom: 120,
  },
  reactionBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  reactionPrewarm: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  reactionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,245,238,0.84)',
  },
  reactionButtonPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: C.coralWash,
  },
  dayLabel: {
    marginTop: 4,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1,
    color: C.ink3,
    textTransform: 'lowercase',
  },
  dayLabelToday: {
    color: C.coral,
  },
  footer: {
    marginTop: 16,
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    lineHeight: 18,
    color: C.ink2,
    letterSpacing: 0.1,
  },
  footerItalic: {
    fontFamily: 'Fraunces-Text-Italic',
    color: C.ink,
  },
});
