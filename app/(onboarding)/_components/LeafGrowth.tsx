import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Persists across unmounts so subsequent navigations initialize with the correct offset
import Animated, {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { BRAND as C } from '@/components/common/BrandGlyphs';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedText = Animated.createAnimatedComponent(Text);

// ─────────────────────────────────────────────────────────────────────────────
const OPTIONS = [
  { id: 0, label: 'Not yet',   sub: 'Just looking today',       stages: 0 },
  { id: 1, label: 'Seedling',  sub: 'Just finding my footing',  stages: 1 },
  { id: 2, label: 'Growing',   sub: 'Making real progress',     stages: 2 },
  { id: 3, label: 'Thriving',  sub: 'Deeply grounded',          stages: 4 },
];

// Target growth value for the "Not yet" option. Small enough that no leaf
// fill is triggered (leftAp0 fades in at STAGE_PROGRESS[0] + 0.01), large
// enough that the stem + first-row ghost outline are visible.
const NOT_YET_PROGRESS = 0.04;

const LEAF_COLOR = '#a6e2a7';
const GHOST_COLOR = '#2E7D32';

// ─── Leaf geometry ────────────────────────────────────────────────────────────
//
//   viewBox 0 0 200 260
//
//   Each leaf is a TILTED CAPSULE whose bottom tip sits exactly on the stem.
//
//   LW  = half-width  (fatness of the leaf)
//   LH  = half-height (half the total leaf length)
//   ANGLE = degrees the leaf leans away from vertical
//           left leaf → –ANGLE  (upper-left direction)
//           right leaf → +ANGLE  (upper-right direction)
//   TIP = bezier pull-back fraction at each pointed end (0=round, 1=sharp)
//
const LW = 24;    // px
const LH = 38;    // px   →  total leaf length = 66 px
const ANGLE = 52;    // deg
const TIP = 0.38;

// Y of stem node for each leaf pair (attachment point; bottom → top order)
const LEAF_YS = [229, 173, 117] as const;

// Bud: vertical capsule at the very top of the stem
const BUD_Y = 85;
const BUD_LW = 14;
const BUD_LH = 24;

// ─── leafPath ─────────────────────────────────────────────────────────────────
//
//   Generates an SVG path for a capsule-shaped leaf.
//
//   The leaf is defined in LOCAL coordinates with its bottom tip at the origin
//   and the body extending upward along the –Y axis. It is then rotated by
//   `angleDeg` and translated so the bottom tip lands at (ax, ay).
//
//   Path visits (clockwise starting from top tip):
//     top tip → right equator → bottom tip → left equator → top tip
//
function leafPath(
  ax: number, ay: number,   // attachment point on stem
  hw: number, hh: number,   // half-width, half-height
  angleDeg: number,
  tip: number,
): string {
  const θ = (angleDeg * Math.PI) / 180;
  const c = Math.cos(θ);
  const s = Math.sin(θ);

  //                          local (x, y)           role
  const pts: [number, number][] = [
    [0, -2 * hh],          // 0  top tip
    [hw * tip, -2 * hh],          // 1  ctrl
    [hw, -(1 + tip) * hh],         // 2  ctrl
    [hw, -hh],              // 3  right equator
    [hw, -(1 - tip) * hh],         // 4  ctrl
    [hw * tip, 0],                // 5  ctrl
    [0, 0],                // 6  bottom tip  ← attachment
    [-hw * tip, 0],                // 7  ctrl
    [-hw, -(1 - tip) * hh],         // 8  ctrl
    [-hw, -hh],              // 9  left equator
    [-hw, -(1 + tip) * hh],         // 10 ctrl
    [-hw * tip, -2 * hh],          // 11 ctrl
  ];

  // Rotate each local point by θ, then translate to world position
  const f = (n: number) => +n.toFixed(1);
  const w = pts.map(([x, y]) => [
    f(x * c - y * s + ax),
    f(x * s + y * c + ay),
  ]);

  // Cubic bezier path: 4 segments × 3 points each
  return (
    `M ${w[0]} ` +
    `C ${w[1]} ${w[2]} ${w[3]} ` +    // top tip → right equator
    `C ${w[4]} ${w[5]} ${w[6]} ` +    // right equator → bottom tip
    `C ${w[7]} ${w[8]} ${w[9]} ` +    // bottom tip → left equator
    `C ${w[10]} ${w[11]} ${w[0]} Z`   // left equator → top tip
  );
}

// Pre-compute paths for every leaf-pair Y and for the bud
const STEM_START_Y = 260;
const STEM_END_Y = 85;
const STEM_X = 100;
const LEAF_GAP = 3.6;
const STEM_LENGTH = STEM_START_Y - STEM_END_Y;
const STEM = `M ${STEM_X} ${STEM_START_Y} L ${STEM_X} ${STEM_END_Y}`;

const L = (y: number) => leafPath(STEM_X - LEAF_GAP, y, LW, LH, -ANGLE, TIP);
const R = (y: number) => leafPath(STEM_X + LEAF_GAP, y, LW, LH, +ANGLE, TIP);

const BUD = leafPath(100, BUD_Y, BUD_LW, BUD_LH, 0, 0.42); // straight up
const STAGE_PROGRESS = [
  (STEM_START_Y - LEAF_YS[0]) / STEM_LENGTH,
  (STEM_START_Y - LEAF_YS[1]) / STEM_LENGTH,
  (STEM_START_Y - LEAF_YS[2]) / STEM_LENGTH,
  1,
] as const;
// 4 options including "Not yet" (id 0). Selection points are the progress
// values closest to each option; targets are where the slider lands after
// release.
const OPTION_SELECTION_POINTS = [
  NOT_YET_PROGRESS,
  STAGE_PROGRESS[0],
  STAGE_PROGRESS[1],
  STAGE_PROGRESS[2],
] as const;
const OPTION_TARGETS = [
  NOT_YET_PROGRESS,
  Math.min(1, STAGE_PROGRESS[0] + 0.24),
  Math.min(1, STAGE_PROGRESS[1] + 0.24),
  1,
] as const;
const SLIDER_W = 300;
const SLIDER_H = 56;
const THUMB = 32;

function nearestOptionIdForProgress(progress: number): number {
  'worklet';
  let bestId = OPTIONS[0].id;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < OPTION_SELECTION_POINTS.length; i++) {
    const distance = Math.abs(progress - OPTION_SELECTION_POINTS[i]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = OPTIONS[i].id;
    }
  }
  return bestId;
}

function targetProgressForOption(optionId: number): number {
  'worklet';
  let index = 0;
  for (let i = 0; i < OPTIONS.length; i++) {
    if (OPTIONS[i].id === optionId) { index = i; break; }
  }
  return OPTION_TARGETS[index] ?? OPTION_TARGETS[0];
}

// ─── Unified ghost / dash style ──────────────────────────────────────────────
const DASH_W = 2;
const DASH_ARR = '5 3';
const GHOST_OP = 0.6;

// ─────────────────────────────────────────────────────────────────────────────

interface LeafGrowthProps {
  onConfirm: (level: number) => void;
}

export function LeafGrowth({ onConfirm }: LeafGrowthProps) {
  const [selected, setSelected] = useState<number>(0);
  const confirming = useRef(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<View>(null);

  // The previous implementation measured the LeafGrowth root in window
  // coordinates and "re-centered" the plant on the device screen via
  // `marginBottom: plantOffset`. That approach is structurally broken
  // on iOS — `Dimensions.get('window').height` and `measureInWindow`
  // disagree about safe-area inclusion across iOS/Android, and the
  // formula returned values large enough to push the plant up past
  // the question's Intro text on iPhone. We don't need any of this.
  // The plant centers naturally within its parent (flexBody) via
  // root's `flex: 1, justifyContent: center`. No measurement needed.
  const onRootLayout = useCallback(() => {}, []);

  const growth = useSharedValue(0);
  const dragStart = useSharedValue(0);

  useEffect(() => {
    return () => {
      cancelAnimation(growth);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    };
  }, []);

  const syncSelected = useCallback((next: number) => {
    setSelected(next);
  }, []);

  const clearPendingConfirm = useCallback(() => {
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }
    confirming.current = false;
  }, []);

  const confirmSelection = useCallback((next: number) => {
    if (confirming.current) return;
    confirming.current = true;
    onConfirm(next);
  }, [onConfirm]);

  const scheduleConfirm = useCallback((next: number) => {
    clearPendingConfirm();
    confirmTimeoutRef.current = setTimeout(() => {
      confirmSelection(next);
    }, 340);
  }, [clearPendingConfirm, confirmSelection]);

  const leftAp0 = useAnimatedProps(() => ({ fillOpacity: interpolate(growth.value, [STAGE_PROGRESS[0] + 0.01, STAGE_PROGRESS[0] + 0.2], [0, 1], Extrapolation.CLAMP) }));
  const leftAp1 = useAnimatedProps(() => ({ fillOpacity: interpolate(growth.value, [STAGE_PROGRESS[1] + 0.01, STAGE_PROGRESS[1] + 0.2], [0, 1], Extrapolation.CLAMP) }));
  const leftAp2 = useAnimatedProps(() => ({ fillOpacity: interpolate(growth.value, [STAGE_PROGRESS[2] + 0.01, STAGE_PROGRESS[2] + 0.2], [0, 1], Extrapolation.CLAMP) }));
  const rightAp0 = useAnimatedProps(() => ({ fillOpacity: interpolate(growth.value, [STAGE_PROGRESS[0] + 0.08, STAGE_PROGRESS[0] + 0.24], [0, 1], Extrapolation.CLAMP) }));
  const rightAp1 = useAnimatedProps(() => ({ fillOpacity: interpolate(growth.value, [STAGE_PROGRESS[1] + 0.08, STAGE_PROGRESS[1] + 0.24], [0, 1], Extrapolation.CLAMP) }));
  const rightAp2 = useAnimatedProps(() => ({ fillOpacity: interpolate(growth.value, [STAGE_PROGRESS[2] + 0.08, STAGE_PROGRESS[2] + 0.24], [0, 1], Extrapolation.CLAMP) }));
  const budAp = useAnimatedProps(() => ({ fillOpacity: interpolate(growth.value, [STAGE_PROGRESS[3] - 0.06, 1], [0, 1], Extrapolation.CLAMP) }));
  // Keep the full dashed skeleton visible on mount. The filled leaves still
  // animate with growth; the outline gives users an immediate visual target.
  const ghostAp0 = useAnimatedProps(() => ({ strokeOpacity: GHOST_OP }));
  const ghostAp1 = useAnimatedProps(() => ({ strokeOpacity: GHOST_OP }));
  const ghostAp2 = useAnimatedProps(() => ({ strokeOpacity: GHOST_OP }));
  const ghostBudAp = useAnimatedProps(() => ({ strokeOpacity: GHOST_OP }));
  const stemAp = useAnimatedProps(() => ({
    d: STEM,
    strokeOpacity: GHOST_OP,
  }));
  const sliderFillStyle = useAnimatedStyle(() => ({
    width: Math.max(THUMB, THUMB + (SLIDER_W - THUMB) * growth.value),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (SLIDER_W - THUMB) * growth.value }],
  }));
  const stageChipStyle = useAnimatedStyle(() => ({
    // Fade in as soon as the user starts dragging so "Not yet" is readable.
    opacity: interpolate(growth.value, [0.01, 0.04], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(growth.value, [0.01, 0.04], [8, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const leftAps = [leftAp0, leftAp1, leftAp2];
  const rightAps = [rightAp0, rightAp1, rightAp2];
  const ghostAps = [ghostAp0, ghostAp1, ghostAp2];
  const pan = Gesture.Pan()
    .minDistance(1)
    .onStart(() => {
      runOnJS(clearPendingConfirm)();
      cancelAnimation(growth);
      dragStart.value = growth.value;
    })
    .onUpdate((event) => {
      const delta = event.translationX / (SLIDER_W - THUMB);
      const next = Math.max(0, Math.min(1, dragStart.value + delta));
      growth.value = next;
      runOnJS(syncSelected)(nearestOptionIdForProgress(next));
    })
    .onEnd(() => {
      const targetId = nearestOptionIdForProgress(growth.value);
      const targetProgress = targetProgressForOption(targetId);
      runOnJS(syncSelected)(targetId);
      growth.value = withTiming(targetProgress, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
      runOnJS(scheduleConfirm)(targetId);
    });

  return (
    <View ref={rootRef} style={s.root} onLayout={onRootLayout}>

      {/* ── Plant ── */}
      <View pointerEvents="none" style={s.plantWrap}>
        

        <Svg width={360} height={360} viewBox="0 25 200 260">

          {/* ── Stem — same style as ghost leaves ── */}
          <AnimatedPath
            d={STEM}
            stroke={GHOST_COLOR}
            strokeWidth={DASH_W}
            strokeDasharray={DASH_ARR}
            fill="none"
            animatedProps={stemAp}
          />

          {/* Filled leaves FIRST */}
          {LEAF_YS.map((y, i) => (
            <React.Fragment key={`fl${y}`}>
              <AnimatedPath d={L(y)} fill={LEAF_COLOR} stroke="none" animatedProps={leftAps[i]} />
              <AnimatedPath d={R(y)} fill={LEAF_COLOR} stroke="none" animatedProps={rightAps[i]} />
            </React.Fragment>
          ))}
          <AnimatedPath d={BUD} fill={LEAF_COLOR} stroke="none" animatedProps={budAp} />

          {/* Ghost outlines AFTER (so they stay on top) */}
          {LEAF_YS.map((y, i) => (
            <React.Fragment key={`gh${y}`}>
              <AnimatedPath d={L(y)} stroke={GHOST_COLOR} strokeWidth={DASH_W}
                strokeDasharray={DASH_ARR} fill="none" animatedProps={ghostAps[i]} />
              <AnimatedPath d={R(y)} stroke={GHOST_COLOR} strokeWidth={DASH_W}
                strokeDasharray={DASH_ARR} fill="none" animatedProps={ghostAps[i]} />
            </React.Fragment>
          ))}
          <AnimatedPath d={BUD} stroke={GHOST_COLOR} strokeWidth={DASH_W}
            strokeDasharray={DASH_ARR} fill="none" animatedProps={ghostBudAp} />

        </Svg>
      </View>

      <Animated.View pointerEvents="none" style={[s.stageChip, stageChipStyle]}>
        <Text style={s.stageChipText}>
          {OPTIONS.find((opt) => opt.id === selected)?.label ?? OPTIONS[0].label}
        </Text>
      </Animated.View>

      <View style={s.sliderArea}>
        <GestureDetector gesture={pan}>
          <Animated.View style={s.sliderTrack}>
            <Animated.View style={[s.sliderFill, sliderFillStyle]} />
            <Animated.View style={[s.sliderThumb, thumbStyle]} />
          </Animated.View>
        </GestureDetector>
        <Text style={s.sliderHint}>Slide to see your emotional growth</Text>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 360,
    height: 360,
    marginBottom: 100,
  },
  placeholderWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  placeholderText: {
    fontFamily: 'Fraunces-Text',
    fontSize: 16,
    color: C.ink3,
    textAlign: 'center',
  },
  stageChip: {
    position: 'absolute',
    bottom: 125,
    width: 132,
    backgroundColor: C.paper,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.line2,
    zIndex: 2,
    alignItems: 'center',
  },
  stageChipText: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    color: C.ink,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  sliderArea: {
    position: 'absolute',
    bottom: 8,
    alignItems: 'center',
    gap: 12,
    zIndex: 3,
  },
  sliderTrack: {
    width: SLIDER_W,
    height: SLIDER_H,
    borderRadius: 999,
    backgroundColor: 'rgba(26,31,54,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(26,31,54,0.2)',
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: 'rgba(26,31,54,0.12)',
  },
  sliderThumb: {
    position: 'absolute',
    left: 12,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: C.ink,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  sliderHint: {
    fontFamily: 'JetBrainsMono',
    fontSize: 11,
    letterSpacing: 2,
    color: C.ink3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
