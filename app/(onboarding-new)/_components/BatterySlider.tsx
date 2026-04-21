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

// ─── Battery Constants ────────────────────────────────────────────────────────

const BATTERY_BODY_H = 360;
const BATTERY_BODY_W = 200;
const BATTERY_BORDER_W = 8;
const BATTERY_BODY_RADIUS = 50;
const BATTERY_GAP = 8;
const BATTERY_INNER_RADIUS = 35;
const BATTERY_FILL_MAX_H = BATTERY_BODY_H - BATTERY_BORDER_W * 2 - BATTERY_GAP * 2;

const BATTERY_COLORS = {
  inputRange: [0, 0.25, 0.5, 0.75, 1] as number[],
  outputRange: ['#E0D4F7', '#D4C4F8', '#C5B0F8', '#B69DF8', '#9D84F8'] as string[],
};

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
  const [terminalColor, setTerminalColor] = useState('rgba(255,255,255,0.9)');

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
      if (isConfirming.current) return;
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

      const levelColor = interpolateColor(
        finalLevel,
        BATTERY_COLORS.inputRange,
        BATTERY_COLORS.outputRange,
      );
      runOnJS(applyTerminalColor)(levelColor);

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

  const fillColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      level.value,
      BATTERY_COLORS.inputRange,
      BATTERY_COLORS.outputRange,
    ),
  }));

  const bodyStyle = useAnimatedStyle(() => {
    const levelColor = interpolateColor(
      level.value,
      BATTERY_COLORS.inputRange,
      BATTERY_COLORS.outputRange,
    );
    return {
      borderColor: interpolateColor(
        borderAnim.value,
        [0, 0.3, 0.75, 1],
        [
          'rgba(255,255,255,0.85)',
          '#cfc3ff',
          '#b69df8',
          levelColor,
        ],
      ),
    };
  });

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
                <Animated.View style={[styles.batteryFill, fillHeightStyle, fillColorStyle]} />
              </View>

              <View style={styles.batteryPctContainer}>
                <Text style={styles.batteryPct}>{displayPct}%</Text>
              </View>
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
    backgroundColor: 'rgba(255,255,255,0.9)',
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
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'transparent',
  },
  batteryInterior: {
    position: 'absolute',
    top: BATTERY_GAP,
    left: BATTERY_GAP,
    right: BATTERY_GAP,
    bottom: BATTERY_GAP,
    borderRadius: BATTERY_INNER_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.15)',
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
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
  },
  batteryHint: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#7A7A8A',
    textAlign: 'center',
    marginTop: 20,
  },
});
