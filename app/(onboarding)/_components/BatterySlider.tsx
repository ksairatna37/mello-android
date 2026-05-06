import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  cancelAnimation,
  runOnJS,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BRAND as C } from '@/components/common/BrandGlyphs';

// ─── Battery Constants ────────────────────────────────────────────────────────

const BATTERY_BODY_H = 360;
const BATTERY_BODY_W = 200;
const BATTERY_BORDER_W = 8;
const BATTERY_BODY_RADIUS = 50;
const BATTERY_GAP = 8;
const BATTERY_INNER_RADIUS = 35;
const BATTERY_FILL_MAX_H = BATTERY_BODY_H - BATTERY_BORDER_W * 2 - BATTERY_GAP * 2;

// Single fill color — matches the question title's ink.
// The battery communicates level purely via fill HEIGHT, no color shifts.
const FILL_COLOR = C.ink;

// ─── Battery Slider ───────────────────────────────────────────────────────────

interface BatterySliderProps {
  initialPct: number;
  onConfirm: (pct: number) => void;
}

export function BatterySlider({ initialPct, onConfirm }: BatterySliderProps) {
  const safeInitial = (
    typeof initialPct === 'number' &&
    !isNaN(initialPct) &&
    initialPct >= 0 &&
    initialPct <= 100
  ) ? initialPct : 50;

  // ── Shared values ──
  const level = useSharedValue(safeInitial / 100);
  const startLevel = useSharedValue(safeInitial / 100);
  const borderAnim = useSharedValue(0);
  const terminalAnim = useSharedValue(0);

  const [displayPct, setDisplayPct] = useState(Math.round(safeInitial));
  const [terminalColor, setTerminalColor] = useState('rgba(26,31,54,0.2)');

  const isConfirming = useRef(false);

  // ── Hint animations ──
  const hintOpacity = useSharedValue(0);
  const hintSlideY = useSharedValue(20);
  const hintBounce = useSharedValue(0);
  const hasInteracted = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Slide-in hint on mount
  useEffect(() => {
    hintOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
    hintSlideY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(level);
      cancelAnimation(borderAnim);
      cancelAnimation(terminalAnim);
      cancelAnimation(hintBounce);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (bounceInterval.current) clearInterval(bounceInterval.current);
    };
  }, []);


  const triggerBounce = useCallback(() => {
    hintBounce.value = withSequence(
      withTiming(-10, { duration: 140, easing: Easing.out(Easing.ease) }),
      withTiming(2, { duration: 110, easing: Easing.in(Easing.ease) }),
      withTiming(-6, { duration: 100, easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: 100, easing: Easing.in(Easing.ease) }),
    );
  }, []);

  useEffect(() => {
    idleTimer.current = setTimeout(() => {
      if (hasInteracted.current) return;
      triggerBounce();
      bounceInterval.current = setInterval(() => {
        if (hasInteracted.current) { clearInterval(bounceInterval.current!); return; }
        triggerBounce();
      }, 4000);
    }, 5000);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (bounceInterval.current) clearInterval(bounceInterval.current);
    };
  }, []);

  const stopIdleAnimations = useCallback(() => {
    hasInteracted.current = true;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (bounceInterval.current) clearInterval(bounceInterval.current);
  }, []);

  const syncDisplay = useCallback((v: number) => {
    const safe = typeof v === 'number' && !isNaN(v)
      ? Math.round(Math.max(0, Math.min(1, v)) * 100)
      : 50;
    setDisplayPct(safe);
  }, []);

  const doConfirm = useCallback((pct: number) => {
    onConfirm(pct);
  }, [onConfirm]);

  const applyTerminalColor = useCallback((color: string) => {
    setTerminalColor(color);
  }, []);

  // ── Pan gesture ──
  const pan = Gesture.Pan()
    .minDistance(1)
    .onStart(() => {
      // Reset the "confirming" latch + decorative animations so the slider
      // is usable again when the user returns to this page after navigating
      // forward and back (e.g. Q5 → Q6 → back to Q5).
      isConfirming.current = false;
      borderAnim.value = 0;
      terminalAnim.value = 0;
      runOnJS(applyTerminalColor)('rgba(26,31,54,0.2)');
      startLevel.value = level.value;
      runOnJS(stopIdleAnimations)();
    })
    .onUpdate((e) => {
      if (isConfirming.current) return;
      const translation = e.translationY;
      if (typeof translation !== 'number' || isNaN(translation)) return;
      const delta = (-translation / BATTERY_BODY_H) * 1.2;
      const next = Math.max(0, Math.min(1, startLevel.value + delta));
      if (!isNaN(next)) {
        level.value = next;
        runOnJS(syncDisplay)(next);
      }
    })
    .onEnd(() => {
      if (isConfirming.current) return;
      isConfirming.current = true;

      const finalLevel = level.value;
      const finalPct = Math.round(finalLevel * 100);

      runOnJS(applyTerminalColor)(FILL_COLOR);

      borderAnim.value = withSequence(
        withTiming(0.3, { duration: 180, easing: Easing.out(Easing.ease) }),
        withTiming(0.75, { duration: 260, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) }),
      );

      terminalAnim.value = withDelay(
        450,
        withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(0.6, { duration: 80 }),
          withTiming(1, { duration: 120 }),
        )
      );

      setTimeout(() => {
        runOnJS(doConfirm)(finalPct);
      }, 650);
    });

  // ── Animated styles ──
  const fillHeightStyle = useAnimatedStyle(() => {
    const h = BATTERY_FILL_MAX_H * level.value;
    return { height: isNaN(h) ? 0 : h };
  });

  // Percentage text color flips ink → cream as the fill passes the text.
  // The text sits at vertical center of the battery (~level 0.5), so we
  // transition around that point.
  const pctColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      level.value,
      [0, 0.4, 0.55, 1],
      [C.ink, C.ink, C.cream, C.cream],
    ),
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      borderAnim.value,
      [0, 0.3, 0.75, 1],
      [
        'rgba(26,31,54,0.4)',   // idle — soft ink outline, reads on coral
        'rgba(26,31,54,0.6)',
        'rgba(26,31,54,0.85)',
        FILL_COLOR,             // confirm — same ink as the fill
      ],
    ),
  }));

  const terminalAnimStyle = useAnimatedStyle(() => ({
    opacity: terminalAnim.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
    transform: [{ translateY: hintSlideY.value + hintBounce.value }],
  }));

  return (
    <View style={styles.batteryOuter}>
      <View style={styles.batterySection}>
        <GestureDetector gesture={pan}>
          <Animated.View style={styles.batteryGestureArea}>

            {/* Terminal nub */}
            <View style={styles.batteryTerminal}>
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: terminalColor },
                  terminalAnimStyle,
                ]}
              />
            </View>

            {/* Battery body */}
            <Animated.View style={[styles.batteryBody, bodyStyle]}>
              <View style={styles.batteryInterior}>
                <Animated.View style={[styles.batteryFill, fillHeightStyle, { backgroundColor: FILL_COLOR }]} />
              </View>

              {/* Percentage — centered inside the battery. Text color
                  animates ink → cream as the fill rises past the text,
                  so the number is always high-contrast against whatever
                  is behind it (coral bg when empty, ink fill when full). */}
              <Animated.View style={[styles.batteryPctContainer]} pointerEvents="none">
                <Animated.Text style={[styles.batteryPct, pctColorStyle]}>{displayPct}%</Animated.Text>
              </Animated.View>
            </Animated.View>

          </Animated.View>
        </GestureDetector>

        <Animated.Text style={[styles.batteryHint, hintStyle]}>Slide up or down</Animated.Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  batteryOuter: {
    flex: 1,
    alignSelf: 'stretch',
  },
  batterySection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  batteryGestureArea: {
    alignItems: 'center',
  },
  batteryTerminal: {
    width: 56,
    height: 20,
    backgroundColor: 'rgba(26,31,54,0.2)',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    marginBottom: 5,
    zIndex: 1,
    overflow: 'hidden',
  },
  batteryBody: {
    width: BATTERY_BODY_W,
    height: BATTERY_BODY_H,
    borderRadius: BATTERY_BODY_RADIUS,
    borderWidth: BATTERY_BORDER_W,
    borderColor: 'rgba(26,31,54,0.4)',
    backgroundColor: 'transparent',
  },
  batteryInterior: {
    position: 'absolute',
    top: BATTERY_GAP,
    left: BATTERY_GAP,
    right: BATTERY_GAP,
    bottom: BATTERY_GAP,
    borderRadius: BATTERY_INNER_RADIUS,
    backgroundColor: 'rgba(26,31,54,0.06)',
    overflow: 'hidden',
  },
  batteryFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: BATTERY_INNER_RADIUS - 2,
  },
  batteryPctContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  batteryPct: {
    fontSize: 52,
    fontFamily: 'Fraunces-Medium',
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
  batteryHint: {
    fontSize: 11,
    fontFamily: 'JetBrainsMono',
    letterSpacing: 2,
    color: C.ink3,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 20,
  },
});
