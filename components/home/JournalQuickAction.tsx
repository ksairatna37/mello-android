/**
 * JournalQuickAction Component - Light Theme
 * Simple white card with "Make a new note in Journal" + "+" button
 * Smooth animation on press
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';

interface JournalQuickActionProps {
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const TIMING = { duration: 150, easing: Easing.out(Easing.ease) };

export default function JournalQuickAction({ onPress }: JournalQuickActionProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.98, TIMING);
      }}
      onPressOut={() => {
        scale.value = withTiming(1, TIMING);
      }}
      style={[styles.card, animatedStyle]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="book-outline" size={22} color={LIGHT_THEME.textSecondary} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Make a new note</Text>
        <Text style={styles.subtitle}>in Journal</Text>
      </View>

      <View style={styles.addButton}>
        <Ionicons name="add" size={24} color={LIGHT_THEME.textPrimary} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    ...CARD_SHADOW,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: LIGHT_THEME.cardYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIGHT_THEME.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
