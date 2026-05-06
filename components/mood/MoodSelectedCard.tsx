/**
 * MoodSelectedCard — confirmation card shown after the user picks a mood.
 *
 * 1:1 port of MBMoodSelectedCard from
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-mood.jsx
 *
 * Layout (left → right):
 *   1. 64×83 dot creature on the chosen mood's tone fill (palette.fill).
 *   2. {mono "— logged H:MM am" + Fraunces "Today, <em>{label}</em>." +
 *       italic note} stacked vertically.
 *   3. "change" mono link in the top-right, fires `onChange`.
 *
 * Background uses the mood's soft surface shade — visually connected to
 * the picker tile while keeping the creature itself vivid.
 *
 * Per page-design.md: lowercase voice, italic emphasis, no emoji, no
 * exclamation marks. The "Today" line is the only sentence-case word
 * (mid-sentence proper noun-feel for the day).
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import MoodDot, { MOOD_PALETTE, type MoodId } from './MoodDot';

interface MoodSelectedCardProps {
  mood: MoodId;
  /** ISO timestamp for the "logged 8:42 am" line. Falls back to "now". */
  loggedAt?: string;
  /** Tap on the "change" mono link. Caller typically resets the mood
   *  state back to null so the picker re-renders. */
  onChange: () => void;
}

const MoodSelectedCard: React.FC<MoodSelectedCardProps> = ({
  mood,
  loggedAt,
  onChange,
}) => {
  const palette = MOOD_PALETTE[mood];

  /* Format the timestamp as a soft "8:42 am" — matches the design's
   * mono-stamped log line. We accept either an ISO string or undefined
   * (defaults to now); never crash if loggedAt is malformed. */
  const stampLabel = useMemo(() => formatLogStamp(loggedAt), [loggedAt]);

  return (
    <View style={[styles.card, { backgroundColor: palette.surface }]}>
      {/* Dot creature on the left, full size for the picked mood. */}
      <View style={styles.dotWrap}>
        <MoodDot mood={mood} size={64} animated delay={0} />
      </View>

      {/* Center copy block — flex-1 so the change link sits right. */}
      <View style={styles.copy}>
        <Text style={styles.stamp}>— logged {stampLabel}</Text>
        <Text style={styles.headline}>
          Today, <Text style={styles.headlineItalic}>{palette.label}</Text>.
        </Text>
        <Text style={styles.note}>{palette.note}</Text>
      </View>

      {/* Top-right "change" affordance — small, mono, ink2. */}
      <Pressable
        onPress={onChange}
        style={styles.changeBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Change mood"
      >
        <Text style={styles.changeText}>change</Text>
      </Pressable>
    </View>
  );
};

export default MoodSelectedCard;

/** "8:42 am" / "12:08 pm". Lowercase meridiem to match the app voice. */
function formatLogStamp(iso?: string): string {
  let d: Date;
  if (iso) {
    const parsed = new Date(iso);
    d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    d = new Date();
  }
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const meridiem = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mm = minutes < 10 ? `0${minutes}` : String(minutes);
  return `${hours}:${mm} ${meridiem}`;
}

const styles = StyleSheet.create({
  card: {
    marginTop: 22,
    borderRadius: RADIUS.card,
    paddingVertical: 18,
    paddingLeft: 16,
    paddingRight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dotWrap: {
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  stamp: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1.4,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  headline: {
    marginTop: 4,
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    lineHeight: 33,
    letterSpacing: -0.3,
    color: C.ink,
  },
  headlineItalic: {
    fontFamily: 'Fraunces-MediumItalic',
  },
  note: {
    marginTop: 4,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 12,
    color: C.ink2,
    letterSpacing: 0.1,
  },
  changeBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  changeText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: C.ink2,
  },
});
