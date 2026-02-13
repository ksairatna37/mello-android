/**
 * GlassCard Component
 * Glassmorphism card for Get Rolling options
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

interface GlassCardProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  multiSelect?: boolean;
  icon?: string;
}

export default function GlassCard({
  label,
  selected = false,
  onPress,
  multiSelect = false,
  icon,
}: GlassCardProps) {
  const handlePress = () => {
    Vibration.vibrate(Platform.OS === 'ios' ? 10 : 50);
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      selected ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.12)',
      { duration: 200, easing: Easing.out(Easing.ease) }
    ),
    borderColor: withTiming(
      selected ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.2)',
      { duration: 200 }
    ),
  }));

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* Selection indicator */}
        <View style={[styles.indicator, selected && styles.indicatorSelected]}>
          {selected && (
            <Ionicons
              name={multiSelect ? 'checkmark' : 'checkmark'}
              size={14}
              color="#1A1A1A"
            />
          )}
        </View>

        {/* Icon (optional) */}
        {icon && (
          <Text style={styles.icon}>{icon}</Text>
        )}

        {/* Label */}
        <Text style={[styles.label, selected && styles.labelSelected]}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  indicatorSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  icon: {
    fontSize: 20,
    marginRight: 10,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#FFFFFF',
  },
  labelSelected: {
    color: '#1A1A1A',
  },
});
