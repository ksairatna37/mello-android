import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const SCREEN_H = Dimensions.get('window').height;
// Persists across unmounts so subsequent navigations initialize with the correct offset
let _cachedPlantOffset = 0;
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

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedText = Animated.createAnimatedComponent(Text);

// ─────────────────────────────────────────────────────────────────────────────
const OPTIONS = [
  { id: 1, label: 'Seedling', sub: 'Just finding my footing', stages: 1 },
  { id: 2, label: 'Growing', sub: 'Making real progress', stages: 2 },
  { id: 3, label: 'Thriving', sub: 'Deeply grounded', stages: 4 },
];

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
const OPTION_SELECTION_POINTS = [STAGE_PROGRESS[0], STAGE_PROGRESS[1], STAGE_PROGRESS[2]] as const;
const OPTION_TARGETS = [
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
  OPTION_SELECTION_POINTS.forEach((target, index) => {
    const distance = Math.abs(progress - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = OPTIONS[index].id;
    }
  });
  return bestId;
}

function targetProgressForOption(optionId: number): number {
  'worklet';
  const index = OPTIONS.findIndex((option) => option.id === optionId);
  return OPTION_TARGETS[Math.max(0, index)] ?? OPTION_TARGETS[0];
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
  const [selected, setSelected] = useState<number>(1);
  const confirming = useRef(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<View>(null);
  const [plantOffset, setPlantOffset] = useState(_cachedPlantOffset);

  const onRootLayout = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y, _w, height) => {
      const next = Math.max(0, 2 * (y + height / 2 - SCREEN_H / 2));
      if (next !== _cachedPlantOffset) {
        _cachedPlantOffset = next;
        setPlantOffset(next);
      }
    });
  }, []);

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
  const ghostAp0 = useAnimatedProps(() => ({ strokeOpacity: interpolate(growth.value, [STAGE_PROGRESS[0] - 0.05, STAGE_PROGRESS[0] + 0.02], [0, GHOST_OP], Extrapolation.CLAMP) }));
  const ghostAp1 = useAnimatedProps(() => ({ strokeOpacity: interpolate(growth.value, [STAGE_PROGRESS[1] - 0.05, STAGE_PROGRESS[1] + 0.02], [0, GHOST_OP], Extrapolation.CLAMP) }));
  const ghostAp2 = useAnimatedProps(() => ({ strokeOpacity: interpolate(growth.value, [STAGE_PROGRESS[2] - 0.05, STAGE_PROGRESS[2] + 0.02], [0, GHOST_OP], Extrapolation.CLAMP) }));
  const ghostBudAp = useAnimatedProps(() => ({ strokeOpacity: interpolate(growth.value, [STAGE_PROGRESS[3] - 0.04, STAGE_PROGRESS[3]], [0, GHOST_OP], Extrapolation.CLAMP) }));
  const stemAp = useAnimatedProps(() => ({
    d: `M ${STEM_X} ${STEM_START_Y} L ${STEM_X} ${(
      STEM_START_Y - STEM_LENGTH * growth.value
    ).toFixed(1)}`,
    strokeOpacity: growth.value === 0 ? 0 : GHOST_OP,
  }));
  const placeholderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(growth.value, [0, 0.06], [1, 0], Extrapolation.CLAMP),
  }));
  const sliderFillStyle = useAnimatedStyle(() => ({
    width: Math.max(THUMB, THUMB + (SLIDER_W - THUMB) * growth.value),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (SLIDER_W - THUMB) * growth.value }],
  }));
  const stageChipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(growth.value, [0.04, 0.1], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(growth.value, [0.04, 0.1], [8, 0], Extrapolation.CLAMP),
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
      <View pointerEvents="none" style={[s.plantWrap, { marginBottom: plantOffset }]}>
        

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
  },
  placeholderWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  placeholderText: {
    fontFamily: 'Outfit-Medium',
    fontSize: 20,
    color: 'rgba(90,90,122,0.65)',
    textAlign: 'center',
  },
  stageChip: {
    position: 'absolute',
    bottom: 125,
    width: 132,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    zIndex: 2,
    alignItems: 'center',
  },
  stageChipText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 17,
    color: '#5A5A7A',
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
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
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
    backgroundColor: 'rgba(139,126,248,0.24)',
  },
  sliderThumb: {
    position: 'absolute',
    left: 12,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#8B7EF8',
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  sliderHint: {
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    color: '#7A7A95',
    textAlign: 'center',
  },
});
