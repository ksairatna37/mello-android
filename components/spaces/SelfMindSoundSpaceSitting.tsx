/**
 * SelfMindSoundSpaceSitting — full-bleed sitting screen.
 *
 * Surfaces a single Sound Space as a contemplative room. The audio
 * player itself is the source of truth for duration / position — the
 * timeline UI reads `audio.durationSec` and `audio.positionSec`
 * directly. There is NO separate session timer. Drag the dot to seek
 * (`audio.seek(targetSec)`); tap to seek to that point. Per-space
 * progress = the audio file's last playback position, restored once
 * when the player reports `isLoaded` for the active source.
 *
 * STEP OUT (chip + Android hardware back) is the only path off this
 * surface and routes to `/spaces`. The heart toggles saved state via
 * `services/spaces/likedSpaces`. The painterly field drifts with
 * `playing`.
 *
 * Routing:
 *  - Missing or unknown `?id=` → `router.replace('/spaces')`. No silent
 *    fallback; we don't want an arbitrary user landing in The Quiet
 *    Room (the "for heavy" steer) without explicit choice.
 *  - STEP OUT (chip + Android hardware back) → `router.replace('/spaces')`.
 *    Always returns to the index, even on cold-boot deep link where
 *    `canGoBack()` would be false.
 *
 * Time accounting:
 *  - `elapsedMs = accumulatedMs + (playing ? Date.now() - sessionStartedAt : 0)`
 *  - 250 ms tick re-renders the clock label and re-positions the dot.
 *  - Pause captures the current segment into `accumulated`; resume
 *    starts a fresh `sessionStartedAt`. No drift, no ghost time.
 *  - When elapsed reaches the room's full duration the screen pauses
 *    automatically (the dot parks at the right edge).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import SpaceArt from '@/components/spaces/SpaceArt';
import { SOUND_SPACES, SPACES_BY_ID, pickTimelineLabel } from '@/services/spaces/spaces';
import {
  getLikedSpacesSync,
  isSpaceLiked,
  toggleSpaceLike,
  subscribeLikedSpaces,
} from '@/services/spaces/likedSpaces';
import {
  getSpaceProgress,
  setSpaceProgress,
  clearSpaceProgress,
} from '@/services/spaces/spaceProgress';
import { playingSpaceStore } from '@/services/spaces/playingSpaceStore';
import { getSpaceBed } from '@/services/spaces/spaceBeds';
import { useAmbientBed } from '@/components/spaces/useAmbientBed';

/* Stable fallback so hooks see a non-null space during the one-frame
 * window between an off-spec mount and the redirect to /spaces. Never
 * rendered — the early `return` below renders an empty view. */
const FALLBACK_SPACE = SOUND_SPACES[0];

const TICK_MS = 250;

export default function SelfMindSoundSpaceSitting() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const resolved = typeof id === 'string' ? SPACES_BY_ID.get(id) : undefined;

  /* Defensive redirect for off-spec state — explicitly allowed by the
   * ghost-screen rule (rules/routing.md §2). The happy path always
   * pushes /space?id=<known-id> from the catalog, so this can never
   * fire when the user navigates here through real UI. We cannot safely
   * pick a default — a silent steer into Quiet Room ("for heavy") is
   * exactly the kind of mental-health-domain misroute we want to avoid. */
  useEffect(() => {
    if (!resolved) router.replace('/spaces' as any);
  }, [resolved, router]);

  /* All hooks below run with a stable, non-null `space` so React sees
   * the same hook order on every render. The fallback only ever runs
   * for the brief moment between mount and the redirect above firing —
   * we render an empty cream view in that window (see end of fn). */
  const space = resolved ?? FALLBACK_SPACE;

  /* ─── Audio-driven transport ────────────────────────────────── */

  /* The audio player owns truth for duration / position. The screen
   * displays them directly in the timeline UI; there is NO separate
   * session timer. Per-space progress = the audio file's last playback
   * position, restored when the player finishes loading. */

  const bed = useMemo(() => getSpaceBed(space.id), [space.id]);
  const bedMeta = useMemo(
    () => ({ title: space.title, artist: 'SelfMind Spaces' }),
    [space.title],
  );

  const [playing, setPlaying] = useState<boolean>(
    () => getSpaceProgress(space.id).playing,
  );

  /* Mirror of `playing` for cleanup callbacks that need the latest
   * value without re-binding on every flip. */
  const playingRef = useRef(playing);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  /* Publish current-playing-space to the global store so the home
   * screen can show a "now playing" indicator beside the bell. We
   * only set the id when actually playing; cleared on pause, on
   * id-change (cleanup runs first → new effect re-publishes), and on
   * unmount (cleanup also runs). */
  useEffect(() => {
    if (playing) {
      playingSpaceStore.set(space.id);
      return () => playingSpaceStore.clear();
    }
    playingSpaceStore.clear();
    return undefined;
  }, [playing, space.id]);

  const audio = useAmbientBed(bed.url, playing, bedMeta);
  const { durationSec, positionSec, isLoaded, seek } = audio;

  /* On id change, reset the restore-once flag so the new space's saved
   * position gets restored on its first isLoaded tick. Also reset
   * `playing` from the new space's saved value. */
  const restoredForRef = useRef<string | null>(null);
  useEffect(() => {
    restoredForRef.current = null;
    setPlaying(getSpaceProgress(space.id).playing);
  }, [space.id]);

  /* `seek` identity changes on every crossfade swap (rebinds when
   * activeKey flips). Mirror via a ref so the restore-effect doesn't
   * re-fire on every swap and depend on it as a dep. */
  const seekRef = useRef(seek);
  useEffect(() => { seekRef.current = seek; }, [seek]);

  /* When the player has finished loading the source for the current
   * space, restore the saved playback position once. Subsequent
   * isLoaded ticks for the SAME space are no-ops. */
  useEffect(() => {
    if (!isLoaded) return;
    if (restoredForRef.current === space.id) return;
    restoredForRef.current = space.id;
    const saved = getSpaceProgress(space.id);
    if (saved.accumulatedMs > 0) {
      seekRef.current(saved.accumulatedMs / 1000);
    }
  }, [isLoaded, space.id]);

  /* Persist position on play / pause toggle and on id-change cleanup
   * below. Inline tick-based persistence isn't needed — the saved
   * value drifts at most a few seconds from truth on app crash, and
   * for ambient audio that's well within tolerance. */
  const togglePlay = useCallback(() => {
    setPlaying((prev) => {
      const next = !prev;
      // Only persist position when the player has actually loaded —
      // before that, `positionSec` is 0 and writing it would wipe the
      // saved value the restore-on-load effect is about to use.
      // Always persist the new playing flag, but preserve the existing
      // accumulatedMs in that case.
      if (isLoaded) {
        setSpaceProgress(space.id, {
          accumulatedMs: positionSec * 1000,
          playing: next,
        });
      } else {
        const saved = getSpaceProgress(space.id);
        setSpaceProgress(space.id, {
          accumulatedMs: saved.accumulatedMs,
          playing: next,
        });
      }
      return next;
    });
  }, [space.id, positionSec, isLoaded]);

  /* Cleanup on id change AND on unmount — snapshot the OUTGOING
   * space's final position via refs so the closure stays correct
   * across renders. */
  const positionRef = useRef(positionSec);
  useEffect(() => { positionRef.current = positionSec; }, [positionSec]);
  useEffect(() => {
    const outgoingId = space.id;
    return () => {
      setSpaceProgress(outgoingId, {
        accumulatedMs: positionRef.current * 1000,
        playing: playingRef.current,
      });
    };
  }, [space.id]);

  /* Seek — used by both tap-on-track and drag. Maps a 0–1 progress
   * fraction to a target second within the audio file's duration and
   * tells the player to jump there. Persist eagerly so the new
   * position survives an immediate step-out. */
  const seekToProgress = useCallback((p: number) => {
    const clamped = Math.max(0, Math.min(1, p));
    if (durationSec <= 0) return; // not loaded yet — nothing to seek into
    const targetSec = clamped * durationSec;
    seek(targetSec);
    setSpaceProgress(space.id, {
      accumulatedMs: targetSec * 1000,
      playing: playingRef.current,
    });
  }, [space.id, durationSec, seek]);

  /* ─── Saved (heart) ─────────────────────────────────────────── */

  const initialLiked = useMemo(() => {
    const sync = getLikedSpacesSync();
    return sync ? sync.has(space.id) : false;
  }, [space.id]);
  const [liked, setLiked] = useState(initialLiked);

  // Hydrate true-state on mount in case sync read returned null.
  useEffect(() => {
    let cancelled = false;
    void isSpaceLiked(space.id).then((v) => {
      if (!cancelled) setLiked(v);
    });
    return () => { cancelled = true; };
  }, [space.id]);

  // Subscribe so external changes (e.g. unliking from Saved tab on the
  // index — not yet wired, but cheap to be future-proof) reflect here.
  // Falls through to the async read if the sync cache hasn't hydrated
  // yet, so a like-event during cold start doesn't desync the heart.
  useEffect(() => {
    return subscribeLikedSpaces(() => {
      const sync = getLikedSpacesSync();
      if (sync) {
        setLiked(sync.has(space.id));
      } else {
        void isSpaceLiked(space.id).then(setLiked);
      }
    });
  }, [space.id]);

  const handleHeart = useCallback(() => {
    void toggleSpaceLike(space.id).then(setLiked);
  }, [space.id]);

  /* ─── Scrubber ──────────────────────────────────────────────── */

  const trackRef = useRef<View | null>(null);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const trackMeasuredRef = useRef(false);
  const dragClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDragSeekAtRef = useRef(0);
  const [draggingProgress, setDraggingProgress] = useState<number | null>(null);

  const measureTrack = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      if (Number.isFinite(x)) trackPageXRef.current = x;
      if (Number.isFinite(width) && width > 0) {
        trackWidthRef.current = width;
        trackMeasuredRef.current = true;
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (dragClearTimeoutRef.current) clearTimeout(dragClearTimeoutRef.current);
    };
  }, []);

  const handleTrackLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
    requestAnimationFrame(measureTrack);
  }, [measureTrack]);

  const progressFromPageX = useCallback((pageX: number): number | null => {
    const w = trackWidthRef.current;
    if (!Number.isFinite(pageX) || w <= 0 || !trackMeasuredRef.current) return null;
    const p = (pageX - trackPageXRef.current) / w;
    if (!Number.isFinite(p)) return null;
    return Math.max(0, Math.min(1, p));
  }, []);

  const seekDuringDrag = useCallback((p: number, force = false) => {
    if (dragClearTimeoutRef.current) {
      clearTimeout(dragClearTimeoutRef.current);
      dragClearTimeoutRef.current = null;
    }
    setDraggingProgress(p);

    // Android can feel rough if we bridge a native seek for every tiny
    // move event. Keep the dot immediate, but coalesce audio seeks.
    const now = Date.now();
    if (!force && now - lastDragSeekAtRef.current < 90) return;
    lastDragSeekAtRef.current = now;
    seekToProgress(p);
  }, [seekToProgress]);

  const scrubFromEvent = useCallback((
    e: GestureResponderEvent,
    gestureState?: PanResponderGestureState,
    forceSeek = false,
  ) => {
    const pageX = gestureState?.moveX && Number.isFinite(gestureState.moveX)
      ? gestureState.moveX
      : e.nativeEvent.pageX;
    const p = progressFromPageX(pageX);
    if (p == null) return;
    seekDuringDrag(p, forceSeek);
  }, [progressFromPageX, seekDuringDrag]);

  const finishScrub = useCallback((
    e: GestureResponderEvent,
    gestureState: PanResponderGestureState,
  ) => {
    scrubFromEvent(e, gestureState, true);
    dragClearTimeoutRef.current = setTimeout(() => {
      dragClearTimeoutRef.current = null;
      setDraggingProgress(null);
    }, 250);
  }, [scrubFromEvent]);

  /* PanResponder owns both tap and drag. We don't toggle `playing` on
   * grant/release — the audio player owns its own playback state. A
   * scrub mid-play stays playing from the new position; a scrub
   * mid-pause stays paused. No tick to suspend, no session start to
   * re-anchor — the audio's own currentTime advances naturally. */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          measureTrack();
          scrubFromEvent(e, undefined, true);
        },
        onPanResponderMove: (e, gestureState) => {
          scrubFromEvent(e, gestureState);
        },
        onPanResponderRelease: finishScrub,
        onPanResponderTerminate: finishScrub,
      }),
    [finishScrub, measureTrack, scrubFromEvent],
  );

  /* ─── Exit ──────────────────────────────────────────────────── */

  const exit = useCallback(() => {
    router.replace('/spaces' as any);
  }, [router]);

  // Hardware back — capture and route through `exit` so the user always
  // returns to /spaces, never falls through to a stale stack entry.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        exit();
        return true;
      });
      return () => sub.remove();
    }, [exit]),
  );

  // Stable per-space label — same room, same word; different rooms,
  // different words. See pickTimelineLabel in services/spaces/spaces.
  const timelineLabel = useMemo(() => pickTimelineLabel(space.id), [space.id]);

  /* ─── Render ────────────────────────────────────────────────── */

  // Off-spec mount — render a blank canvas while the defensive redirect
  // above resolves on the next tick.
  if (!resolved) return <View style={styles.root} />;

  // Audio-driven timeline values. Until the source loads, durationSec
  // is 0 — render the timeline with 0:00 placeholders rather than
  // showing the room's `space.minutes` (which has nothing to do with
  // the actual audio file's length).
  const audioProgress = durationSec > 0 ? Math.min(1, positionSec / durationSec) : 0;
  const progress = draggingProgress ?? audioProgress;
  const displayPositionSec = draggingProgress != null && durationSec > 0
    ? draggingProgress * durationSec
    : positionSec;
  const elapsedClock = formatClock(displayPositionSec * 1000);
  const totalClock = durationSec > 0 ? formatClock(durationSec * 1000) : '--:--';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Full-bleed painterly field. The room itself owns the only dot
       *  on this screen — the timeline progress dot below. */}
      <SpaceArt
        palette={space.palette}
        variant="field"
        moving={playing}
        showDot={false}
        showHorizon={false}
      />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Top row */}
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={exit}
            activeOpacity={0.85}
            style={styles.glassChip}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Glyphs.Close size={12} color={C.ink} />
            <Text style={styles.chipLabel}>STEP OUT</Text>
          </TouchableOpacity>
        </View>

        {/* Audio-coming-soon hairline — surfaces only when this room
         * has no track yet. Honest signal beats silent gaslighting on
         * a contemplative surface. Removed automatically once the bed
         * URL is populated in services/spaces/spaceBeds.ts. */}
        {bed.url === null && (
          <Text style={styles.audioComingSoon}>— sound for this room is coming</Text>
        )}

        {/* Empty room */}
        <View style={{ flex: 1 }} />

        {/* Scrubber — tap or drag the dot to seek. The track is an
         * invisible 44 px touch area so the gesture is comfortable;
         * only the ink dot is visible so the field stays uncluttered.
         * `panHandlers` cover both tap (grant fires once) and drag. */}
        <View
          ref={trackRef}
          {...panResponder.panHandlers}
          onLayout={handleTrackLayout}
          style={styles.scrubTrack}
        >
          {/* Track line — sits at the same vertical center as the dot
           *  (both pinned to top:50% of the same parent), so the dot
           *  always rides exactly on the line on any device height. */}
          <View pointerEvents="none" style={styles.trackLine} />
          <View
            pointerEvents="none"
            style={[
              styles.progressDot,
              { left: `${progress * 100}%` },
            ]}
          />
        </View>
        <View style={styles.timelineRow}>
          <Text style={styles.timeLabel}>{elapsedClock}</Text>
          <Text style={styles.timeDrifting}>{timelineLabel}</Text>
          <Text style={styles.timeLabel}>{totalClock}</Text>
        </View>

        {/* Title + line — sits below the timeline now */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{space.title}</Text>
          <Text style={styles.line}>{space.line}.</Text>
        </View>

        {/* Controls — symmetric: invisible spacer left, play/pause
         * dead-center, large heart right. */}
        <View style={styles.controls}>
          <View style={styles.spacerSlot} />

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.playBtn}
            onPress={togglePlay}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleHeart}
            activeOpacity={0.7}
            style={styles.heartBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {liked
              ? <Glyphs.HeartFilled size={40} color={C.coral} />
              : <Glyphs.Heart size={40} color={C.ink} />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ─── Inline play/pause icons ─────────────────────────────────────── */

/* Both icons share the same 28×28 viewport so the visual weight
 * matches across the toggle. Soft corners: pause uses generous rx;
 * play uses stroke-linejoin=round on a same-color stroke around a
 * filled triangle so all three vertices read as soft points. */

function PauseIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24">
      <Rect x={6}  y={5} width={4.5} height={14} rx={2.25} fill={C.cream} />
      <Rect x={13.5} y={5} width={4.5} height={14} rx={2.25} fill={C.cream} />
    </Svg>
  );
}

function PlayIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24">
      <Path
        d="M8 5.5l11 6.5-11 6.5z"
        fill={C.cream}
        stroke={C.cream}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const HEART_BTN = 64;
const PLAY_BTN = 64;
const DOT_SIZE = 14;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream, overflow: 'hidden' },
  content: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glassChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    backgroundColor: C.glassMuted,
  },
  audioComingSoon: {
    marginTop: 14,
    alignSelf: 'center',
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1.2,
    color: C.ink3,
    textTransform: 'lowercase',
  },
  chipLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 12,
    letterSpacing: 1.2,
    color: C.ink,
  },

  titleBlock: {
    marginTop: 28,
  },
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.8,
    color: C.ink,
  },
  line: {
    marginTop: 12,
    maxWidth: 300,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 15,
    lineHeight: 22,
    color: C.ink2,
  },

  scrubTrack: {
    marginTop: 28,
    height: 44,
    justifyContent: 'center',
  },
  trackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    marginTop: -0.5,
    backgroundColor: C.hairlineInk18,
  },
  progressDot: {
    position: 'absolute',
    top: '50%',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginLeft: -DOT_SIZE / 2,
    marginTop: -DOT_SIZE / 2,
    backgroundColor: C.ink,
  },
  timelineRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 1.0,
    color: C.ink2,
  },
  timeDrifting: {
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 13,
    color: C.ink,
    letterSpacing: -0.1,
  },

  controls: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.chip,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  /* Left spacer matches the heart slot so play/pause sits at the exact
   * geometric center of the control bar. */
  spacerSlot: {
    width: HEART_BTN,
    height: HEART_BTN,
  },
  playBtn: {
    width: PLAY_BTN,
    height: PLAY_BTN,
    borderRadius: PLAY_BTN / 2,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtn: {
    width: HEART_BTN,
    height: HEART_BTN,
    borderRadius: HEART_BTN / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
