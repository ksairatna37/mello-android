import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import type { Option } from './types';

// ─── Option Card ─────────────────────────────────────────────────────────────

interface OptionCardProps {
  option: Option;
  selected: boolean;
  dimmed: boolean;
  onPress: () => void;
}

export function OptionCard({ option, selected, dimmed, onPress }: OptionCardProps) {
  const anim = useSharedValue(selected ? 1 : 0);
  const dimAnim = useSharedValue(dimmed ? 0.5 : 1);

  useEffect(() => {
    anim.value = withTiming(selected ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.ease),
    });
  }, [selected]);

  useEffect(() => {
    dimAnim.value = withTiming(dimmed ? 0.5 : 1, {
      duration: 280,
      easing: Easing.inOut(Easing.ease),
    });
  }, [dimmed]);

  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: dimAnim.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255,255,255,${0.55 + anim.value * 0.35})`,
    borderColor: `rgba(139,126,248,${0.12 + anim.value * 0.63})`,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(anim.value, [0, 1], ['#1A1A1A', '#8B7EF8']),
  }));

  const descStyle = useAnimatedStyle(() => ({
    color: interpolateColor(anim.value, [0, 1], ['#9999A8', '#8B7EF8']),
  }));

  return (
    <Animated.View style={wrapperStyle}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        <Animated.View style={[styles.optionCard, cardStyle]}>
          <View style={styles.iconBadge}>
            <Text style={styles.emoji}>{option.icon}</Text>
          </View>

          <View style={styles.optionTextBlock}>
            <Animated.Text
              style={[
                styles.optionLabel,
                option.description === '' && styles.optionLabelStandalone,
                labelStyle,
              ]}
            >
              {option.label}
            </Animated.Text>
            {option.description !== '' && (
              <Animated.Text style={[styles.optionDescription, descStyle]}>
                {option.description}
              </Animated.Text>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 2,
    gap: 12,
  },
  iconBadge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  optionTextBlock: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    marginBottom: 1,
  },
  optionLabelStandalone: {
    marginBottom: 0,
  },
  optionDescription: {
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
    color: '#999999',
  },
});
