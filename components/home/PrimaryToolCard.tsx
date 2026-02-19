/**
 * PrimaryToolCard Component - Light Theme
 * Large white card with soft shadow for Voice/Chat primary tools
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
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';

interface PrimaryToolCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  ctaText: string;
  accentColor: string;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const TIMING = { duration: 150, easing: Easing.out(Easing.ease) };

export default function PrimaryToolCard({
  icon,
  title,
  subtitle,
  ctaText,
  accentColor,
  onPress,
}: PrimaryToolCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.card, animatedStyle]}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, TIMING);
      }}
      onPressOut={() => {
        scale.value = withTiming(1, TIMING);
      }}
    >
      <View style={[styles.iconCircle, { backgroundColor: accentColor + '25' }]}>
        <Ionicons name={icon} size={28} color={accentColor} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.ctaRow}>
        <Text style={styles.ctaText}>{ctaText}</Text>
        <Ionicons name="arrow-forward" size={14} color={LIGHT_THEME.textMuted} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 180,
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 24,
    padding: 18,
    justifyContent: 'space-between',
    ...CARD_SHADOW,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaText: {
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
  },
});
