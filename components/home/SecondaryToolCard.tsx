/**
 * SecondaryToolCard Component - Light Theme
 * Smaller white card with soft shadow for Mood History, Journal, Crisis Help
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LIGHT_THEME, CARD_SHADOW_LIGHT } from '@/components/common/LightGradient';

interface SecondaryToolCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  actionText: string;
  accentColor: string;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const TIMING = { duration: 150, easing: Easing.out(Easing.ease) };

export default function SecondaryToolCard({
  icon,
  title,
  actionText,
  accentColor,
  onPress,
}: SecondaryToolCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.card, animatedStyle]}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.95, TIMING);
      }}
      onPressOut={() => {
        scale.value = withTiming(1, TIMING);
      }}
    >
      <View style={[styles.iconCircle, { backgroundColor: accentColor + '25' }]}>
        <Ionicons name={icon} size={20} color={accentColor} />
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.actionText}>{actionText}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 110,
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    padding: 14,
    justifyContent: 'space-between',
    ...CARD_SHADOW_LIGHT,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  actionText: {
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
  },
});
