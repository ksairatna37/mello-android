/**
 * MoodFace Component
 * Colorful SVG circular faces with expressions
 * 5 mood variations: great, good, okay, low, rough
 */

import React from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { LIGHT_THEME } from '@/components/common/LightGradient';

export type MoodType = 'great' | 'good' | 'okay' | 'low' | 'rough';

interface MoodFaceProps {
  mood: MoodType;
  size?: number;
  onPress?: () => void;
  selected?: boolean;
  showLabel?: boolean;
}

const MOOD_CONFIG: Record<MoodType, { color: string; label: string }> = {
  great: { color: LIGHT_THEME.moodGreat, label: 'Great' },
  good: { color: LIGHT_THEME.moodGood, label: 'Good' },
  okay: { color: LIGHT_THEME.moodOkay, label: 'Okay' },
  low: { color: LIGHT_THEME.moodLow, label: 'Low' },
  rough: { color: LIGHT_THEME.moodRough, label: 'Rough' },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function MoodFace({
  mood,
  size = 48,
  onPress,
  selected = false,
  showLabel = false,
}: MoodFaceProps) {
  const scale = useSharedValue(1);
  const config = MOOD_CONFIG[mood];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.9, { duration: 150, easing: Easing.out(Easing.ease) });
  };

  const handlePressOut = () => {
    scale.value = withTiming(selected ? 1.1 : 1, { duration: 150, easing: Easing.out(Easing.ease) });
  };

  return (
    <View style={styles.container}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          animatedStyle,
          selected && styles.selected,
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 48 48">
          {/* Face circle */}
          <Circle cx="24" cy="24" r="22" fill={config.color} />

          {/* Eyes */}
          <G>
            {mood === 'great' && (
              <>
                {/* Happy closed eyes (curved) */}
                <Path
                  d="M14 20 Q16 17 18 20"
                  stroke="#1a1625"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M30 20 Q32 17 34 20"
                  stroke="#1a1625"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            )}
            {mood === 'good' && (
              <>
                {/* Normal happy eyes */}
                <Circle cx="16" cy="19" r="2.5" fill="#1a1625" />
                <Circle cx="32" cy="19" r="2.5" fill="#1a1625" />
              </>
            )}
            {mood === 'okay' && (
              <>
                {/* Neutral eyes */}
                <Circle cx="16" cy="20" r="2.5" fill="#1a1625" />
                <Circle cx="32" cy="20" r="2.5" fill="#1a1625" />
              </>
            )}
            {mood === 'low' && (
              <>
                {/* Slightly droopy eyes */}
                <Circle cx="16" cy="21" r="2.5" fill="#1a1625" />
                <Circle cx="32" cy="21" r="2.5" fill="#1a1625" />
              </>
            )}
            {mood === 'rough' && (
              <>
                {/* Sad eyes */}
                <Circle cx="16" cy="20" r="2.5" fill="#1a1625" />
                <Circle cx="32" cy="20" r="2.5" fill="#1a1625" />
              </>
            )}
          </G>

          {/* Mouth */}
          <G>
            {mood === 'great' && (
              /* Big smile */
              <Path
                d="M14 28 Q24 38 34 28"
                stroke="#1a1625"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            )}
            {mood === 'good' && (
              /* Small smile */
              <Path
                d="M16 30 Q24 35 32 30"
                stroke="#1a1625"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            )}
            {mood === 'okay' && (
              /* Neutral line */
              <Path
                d="M17 32 L31 32"
                stroke="#1a1625"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            )}
            {mood === 'low' && (
              /* Slight frown */
              <Path
                d="M16 34 Q24 30 32 34"
                stroke="#1a1625"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            )}
            {mood === 'rough' && (
              /* Sad frown */
              <Path
                d="M14 36 Q24 28 34 36"
                stroke="#1a1625"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            )}
          </G>
        </Svg>
      </AnimatedPressable>

      {showLabel && (
        <Text style={[styles.label, selected && styles.labelSelected]}>
          {config.label}
        </Text>
      )}
    </View>
  );
}

// Row of all 5 mood faces for check-in
interface MoodFaceRowProps {
  selectedMood?: MoodType;
  onSelectMood: (mood: MoodType) => void;
  size?: number;
}

export function MoodFaceRow({ selectedMood, onSelectMood, size = 48 }: MoodFaceRowProps) {
  const moods: MoodType[] = ['great', 'good', 'okay', 'low', 'rough'];

  return (
    <View style={styles.row}>
      {moods.map((mood) => (
        <MoodFace
          key={mood}
          mood={mood}
          size={size}
          selected={selectedMood === mood}
          onPress={() => onSelectMood(mood)}
          showLabel
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
  },
  selected: {
    transform: [{ scale: 1.1 }],
  },
  label: {
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
    textTransform: 'capitalize',
  },
  labelSelected: {
    color: LIGHT_THEME.textPrimary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
});
