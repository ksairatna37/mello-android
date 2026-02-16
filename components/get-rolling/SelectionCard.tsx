/**
 * SelectionCard Component for Get Rolling Flow
 * Dark theme variant of the onboarding OptionCard
 *
 * Features:
 * - Animated selection with checkbox
 * - Works on dark aurora backgrounds
 * - Single or multi-select support
 * - LinearTransition for reordering
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  LinearTransition,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

interface SelectionCardProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  accentColor?: string; // For checkmark, matches aurora theme
}

export const SelectionCard = ({
  label,
  isSelected,
  onPress,
  accentColor = '#1A1A1A',
}: SelectionCardProps) => {
  const animatedValue = useSharedValue(isSelected ? 1 : 0);

  React.useEffect(() => {
    animatedValue.value = withTiming(isSelected ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.ease),
    });
  }, [isSelected]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255, 255, 255, ${0.08 + animatedValue.value * 0.08})`,
    borderWidth: 1.5 + animatedValue.value * 0.5,
    borderColor: `rgba(255, 255, 255, ${0.15 + animatedValue.value * 0.25})`,
  }));

  const checkboxStyle = useAnimatedStyle(() => ({
    opacity: animatedValue.value,
    transform: [{ scale: 0.8 + animatedValue.value * 0.2 }],
  }));

  return (
    <Animated.View
      layout={LinearTransition.duration(350).easing(Easing.bezier(0.25, 0.1, 0.25, 1))}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Animated.View style={[styles.card, containerStyle]}>
          <Text style={styles.label}>{label}</Text>
          <Animated.View style={[styles.checkbox, checkboxStyle]}>
            <View style={[styles.checkboxFilled, { backgroundColor: '#FFFFFF' }]}>
              <Ionicons name="checkmark" size={16} color={accentColor} />
            </View>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  label: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#FFFFFF',
    flex: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFilled: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SelectionCard;
