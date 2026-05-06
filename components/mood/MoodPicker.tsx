/**
 * MoodPicker — five-up row of bobbing mood creatures.
 *
 * Layout:
 *   Five MoodDots side by side, label below each (italic Fraunces, 11pt).
 *   Each cell is tappable; selecting one bumps `selected` and the
 *   parent typically replaces this whole picker with a MoodSelectedCard.
 *
 * Visual states (per design, mobile-mood.jsx):
 *   - Idle (no selection):     all five dots animated, full opacity, scale 1.
 *   - Previewing one selected: the chosen dot scaled to 1.04 with a soft
 *     ink-04 background wash; the other four dim to opacity 0.32.
 *   - Tap dispatches `onSelect(mood)` synchronously — the parent owns
 *     the persistence side-effect.
 *
 * Per page-design.md voice rules: lowercase italic labels, no emoji,
 * Fraunces text cut.
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BRAND as C } from '@/components/common/BrandGlyphs';
import MoodDot, { MOOD_KEYS, MOOD_PALETTE, type MoodId } from './MoodDot';

interface MoodPickerProps {
  /** Current selection. `null` = nothing picked yet (all five dots equal). */
  selected: MoodId | null;
  /** Fired with the tapped mood id. Parent decides whether to persist. */
  onSelect: (mood: MoodId) => void;
  /** Cell dot size in dp. Default 50 matches the home picker reference. */
  dotSize?: number;
}

const MoodPicker: React.FC<MoodPickerProps> = ({
  selected,
  onSelect,
  dotSize = 50,
}) => {
  return (
    <View style={styles.row}>
      {MOOD_KEYS.map((m, i) => (
        <PickerCell
          key={m}
          mood={m}
          index={i}
          dotSize={dotSize}
          isSel={selected === m}
          isDim={selected !== null && selected !== m}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
};

export default MoodPicker;

// ─── Per-cell with own pressed-scale animation ──────────────────────
//
// Extracted into its own component so each cell owns a SharedValue
// for the press animation. Trying to drive 7 cells from one Reanimated
// value would either use indexes (clunky) or re-render the whole row
// on every press (jank). One small component per cell keeps the
// animated state local + cheap.

interface PickerCellProps {
  mood: MoodId;
  index: number;
  dotSize: number;
  isSel: boolean;
  isDim: boolean;
  onSelect: (m: MoodId) => void;
}

const PickerCell: React.FC<PickerCellProps> = ({
  mood, index, dotSize, isSel, isDim, onSelect,
}) => {
  const palette = MOOD_PALETTE[mood];

  /* Press animation — 90ms scale-down to 0.94 on press, 120ms
   * spring-less return to 1.0 on release. Provides tactile feedback
   * before the home screen's picker→card swap fires (~20ms after the
   * onPress callback resolves). Without this, the user gets no
   * visual confirmation between tap and card mount. */
  const pressScale = useSharedValue(1);
  const onPressIn = useCallback(() => {
    pressScale.value = withTiming(0.94, { duration: 90, easing: Easing.out(Easing.cubic) });
  }, [pressScale]);
  const onPressOut = useCallback(() => {
    pressScale.value = withTiming(1.0, { duration: 120, easing: Easing.out(Easing.cubic) });
  }, [pressScale]);

  /* Selected cells are visually scaled to 1.04 (subtle pop). Press
   * scale combines with that — they multiply correctly because we
   * read pressScale.value × selBase, not write to a static transform. */
  const selBase = isSel ? 1.04 : 1.0;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * selBase }],
  }));

  return (
    <AnimatedPressable
      onPress={() => onSelect(mood)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      /* Dim siblings are visually de-emphasised AND disabled — see
       * MoodPicker docstring. */
      disabled={isDim}
      style={[
        styles.cell,
        isDim && styles.cellDim,
        animatedStyle,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Mood: ${MOOD_PALETTE[mood].label}` + (isSel ? ' (selected)' : '')}
      accessibilityState={{ disabled: isDim, selected: isSel }}
      hitSlop={6}
    >
      <View
        style={[
          styles.avatarTab,
          {
            width: dotSize + 12,
            height: dotSize + 12,
            backgroundColor: palette.surface,
          },
          isSel && styles.avatarTabSelected,
        ]}
      >
        <MoodDot
          mood={mood}
          size={dotSize}
          animated={false}
          delay={index * 150}
        />
      </View>
      <Text
        style={[styles.label, isSel && styles.labelSelected]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {MOOD_PALETTE[mood].label}
      </Text>
    </AnimatedPressable>
  );
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    /* Five equal cells across the available width. `gap` keeps inter-
     * cell spacing consistent without per-cell margins. */
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 22,
    paddingBottom: 4,
    gap: 4,
  },
  cell: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 16,
  },
  avatarTab: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(26,31,54,0.06)',
  },
  avatarTabSelected: {
    borderColor: 'rgba(26,31,54,0.18)',
  },
  cellDim: {
    opacity: 0.32,
  },
  label: {
    marginTop: 4,
    width: '100%',
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 11,
    letterSpacing: 0,
    color: C.ink2,
    lineHeight: 16,
    textAlign: 'center',
  },
  labelSelected: {
    color: C.ink,
    fontFamily: 'Fraunces-MediumItalic',
  },
});
