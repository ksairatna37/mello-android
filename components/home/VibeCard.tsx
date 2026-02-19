/**
 * VibeCard Component
 * Colorful mood card with abstract icon, name, and mood label
 * Matches the "You" and "Samantha" cards in the design
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Path, G, Line } from 'react-native-svg';
import { LIGHT_THEME } from '@/components/common/LightGradient';
import { green } from 'react-native-reanimated/lib/typescript/Colors';

export type VibeMood =
  | 'tired'
  | 'connected'
  | 'calm'
  | 'energized'
  | 'anxious'
  | 'grateful'
  | 'neutral'
  | 'happy'
  | 'sad';

interface VibeCardProps {
  name: string;
  mood: VibeMood;
  color: string;
  onPress?: () => void;
  isInteractive?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const TIMING = { duration: 150, easing: Easing.out(Easing.ease) };

// Color presets
export const VIBE_COLORS = {
  blue: '#A8D4F0',
  yellow: '#F5C542',
  mint: '#A8E6CF',
  coral: '#FFB5A7',
  lavender: '#D4B8E0',
  peach: '#FFDAB9',
  green: '#B5EAD7',
};

export default function VibeCard({
  name,
  mood,
  color,
  onPress,
  isInteractive = true,
}: VibeCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (isInteractive) {
      scale.value = withTiming(0.96, TIMING);
    }
  };

  const handlePressOut = () => {
    if (isInteractive) {
      scale.value = withTiming(1, TIMING);
    }
  };

  const moodLabel = mood.charAt(0).toUpperCase() + mood.slice(1);

  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: color }, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!isInteractive}
    >
      <Text style={styles.name}>{name}</Text>
      <View style={styles.iconContainer}>
        <MoodIcon mood={mood} size={64} />
      </View>
      <Text style={styles.moodLabel}>{moodLabel}</Text>
    </AnimatedPressable>
  );
}

// Abstract mood icons (SVG)
interface MoodIconProps {
  mood: VibeMood;
  size: number;
}

function MoodIcon({ mood, size }: MoodIconProps) {
  const iconColor = '#1a1625';

  switch (mood) {
    case 'tired':
      // Wavy lines (like in the design - 6 small waves)
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <G stroke={iconColor} strokeWidth="3" fill="none" strokeLinecap="round">
            {/* Row 1 */}
            <Path d="M12 20 Q16 16, 20 20 Q24 24, 28 20" />
            <Path d="M36 20 Q40 16, 44 20 Q48 24, 52 20" />
            {/* Row 2 */}
            <Path d="M12 36 Q16 32, 20 36 Q24 40, 28 36" />
            <Path d="M36 36 Q40 32, 44 36 Q48 40, 52 36" />
          </G>
        </Svg>
      );

    case 'connected':
    case 'energized':
      // Starburst/sun rays (like in the design)
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <G stroke={iconColor} strokeWidth="3" strokeLinecap="round">
            <Circle cx="32" cy="32" r="8" fill={iconColor} />
            {/* Rays */}
            <Line x1="32" y1="8" x2="32" y2="18" />
            <Line x1="32" y1="46" x2="32" y2="56" />
            <Line x1="8" y1="32" x2="18" y2="32" />
            <Line x1="46" y1="32" x2="56" y2="32" />
            <Line x1="15" y1="15" x2="22" y2="22" />
            <Line x1="42" y1="42" x2="49" y2="49" />
            <Line x1="49" y1="15" x2="42" y2="22" />
            <Line x1="22" y1="42" x2="15" y2="49" />
          </G>
        </Svg>
      );

    case 'calm':
      // Concentric circles / ripples
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <G stroke={iconColor} strokeWidth="2.5" fill="none">
            <Circle cx="32" cy="32" r="8" />
            <Circle cx="32" cy="32" r="16" />
            <Circle cx="32" cy="32" r="24" />
          </G>
        </Svg>
      );

    case 'anxious':
      // Zigzag lines
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <G stroke={iconColor} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 24 L22 16 L32 24 L42 16 L52 24" />
            <Path d="M12 40 L22 32 L32 40 L42 32 L52 40" />
          </G>
        </Svg>
      );

    case 'grateful':
    case 'happy':
      // Heart shape
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Path
            d="M32 52 C24 44, 12 36, 12 24 C12 16, 20 12, 32 22 C44 12, 52 16, 52 24 C52 36, 40 44, 32 52"
            fill={iconColor}
          />
        </Svg>
      );

    case 'sad':
      // Single droplet
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Path
            d="M32 12 C32 12, 48 32, 48 42 C48 52, 40 56, 32 56 C24 56, 16 52, 16 42 C16 32, 32 12, 32 12"
            fill={iconColor}
          />
        </Svg>
      );

    case 'neutral':
    default:
      // Simple circle
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Circle cx="32" cy="32" r="20" fill={iconColor} />
        </Svg>
      );
  }
}

// Dual card layout component
interface VibeCardsRowProps {
  userMood?: VibeMood;
  companionMood?: VibeMood;
  userName?: string;
  onUserCardPress?: () => void;
  onCompanionCardPress?: () => void;
}

export function VibeCardsRow({
  userMood = 'neutral',
  companionMood = 'connected',
  userName = 'You',
  onUserCardPress,
  onCompanionCardPress,
}: VibeCardsRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.cardWrapper}>
        <VibeCard
          name={userName}
          mood={userMood}
          color={VIBE_COLORS.blue}
          onPress={onUserCardPress}
        />
      </View>
      <View style={styles.cardWrapper}>
        <VibeCard
          name="Mello"
          mood={companionMood}
          color={VIBE_COLORS.green}
          onPress={onCompanionCardPress}
          isInteractive={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 160,
  },
  name: {
    fontSize: 15,
    fontFamily: 'Outfit-Medium',
    color: '#C44536',
    textAlign: 'center',
  },
  iconContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  moodLabel: {
    fontSize: 20,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cardWrapper: {
    flex: 1,
  },
});
