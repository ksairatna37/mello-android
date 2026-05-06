/**
 * SuggestionChips — pill-shaped tappable chips of next-user-message
 * suggestions. Two use sites:
 *
 *   1. Greeting state — preset openers (`PRESET_GREETING_CHIPS`).
 *      Hardcoded, always shown when chat is empty.
 *
 *   2. Per-AI-response — Bedrock-generated 2–4 chips below the most
 *      recent assistant message when the "suggestion on" toggle is
 *      lit. Caller fetches via `generateChatSuggestions()` and passes
 *      strings in.
 *
 * Visual treatment per `rules/page-design.md`: lavender tonal pill,
 * Fraunces serif label (matches the soft conversational voice), no
 * emoji, lowercase. While loading we render three pulse-skeleton
 * placeholders so the surface never feels empty.
 *
 * Tap behaviour: invoke `onPick(text)`. Caller decides whether to set
 * the input pill or send directly — current product spec is "set
 * input, user hits send" so nothing about send is in this component.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BRAND as C } from '@/components/common/BrandGlyphs';

/** Preset openers for the greeting state. Lowercase, no emoji, in
 *  line with page-design.md voice rules. Order matters — most-likely
 *  first. */
export const PRESET_GREETING_CHIPS: ReadonlyArray<string> = [
  "i'm anxious",
  "can't sleep",
  'need to vent',
  'just checking in',
];

/** Loading-skeleton pill widths (dp). Three values approximating the
 *  typical chip width distribution so the skeleton row doesn't read
 *  as a uniform bar. */
const SKELETON_WIDTHS: ReadonlyArray<number> = [110, 92, 130];

interface Props {
  /** The chip labels to render, in display order. */
  chips: ReadonlyArray<string>;
  /** Tap handler — caller fills the input or sends as it sees fit. */
  onPick: (text: string) => void;
  /** When true, render three pulse-skeleton placeholders instead of
   *  chips. Used while Bedrock is producing suggestions for the
   *  latest AI message. */
  loading?: boolean;
  /** Optional accessibility hint for the row. */
  ariaLabel?: string;
  /** Greeting-state chips should center each wrapped line; message
   *  suggestions stay left-aligned under the AI bubble. */
  align?: 'left' | 'center';
}

export default function SuggestionChips({ chips, onPick, loading, ariaLabel, align = 'left' }: Props) {
  /* Soft pulse for the loading skeletons. */
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    if (!loading) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [loading, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (loading) {
    return (
      <View
        style={[styles.row, align === 'center' && styles.rowCenter]}
        accessibilityLabel={ariaLabel ?? 'Loading suggestions'}
      >
        {SKELETON_WIDTHS.map((w, i) => (
          <Animated.View
            key={'skel-' + i}
            style={[styles.chip, styles.chipSkel, { width: w }, pulseStyle]}
          />
        ))}
      </View>
    );
  }

  if (chips.length === 0) return null;

  return (
    <View
      style={[styles.row, align === 'center' && styles.rowCenter]}
      accessibilityLabel={ariaLabel ?? 'Message suggestions'}
    >
      {chips.map((c, i) => (
        <Pressable
          key={c + ':' + i}
          style={({ pressed }) => [
            styles.chip,
            pressed && styles.chipPressed,
          ]}
          onPress={() => onPick(c)}
          accessibilityRole="button"
          accessibilityLabel={`Use suggestion: ${c}`}
        >
          <Text style={styles.chipText} numberOfLines={2}>{c}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  rowCenter: {
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: C.lavender,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    /* Cap chip width so a long suggestion wraps neatly instead of
     * bleeding off the edge. ~62% of phone width works at 360–430dp. */
    maxWidth: '92%',
  },
  chipPressed: {
    /* Slightly deeper lavender on press — same hue family, no flicker. */
    backgroundColor: C.lavenderPress,
  },
  chipText: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 14,
    lineHeight: 18,
    color: C.lavenderDeep,
    letterSpacing: 0.1,
  },
  chipSkel: {
    height: 36,
    backgroundColor: C.lavenderSkel,
  },
});
