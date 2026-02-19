/**
 * FeatureCard Component
 * Pinterest-style glassmorphic card for the homepage masonry grid
 * Variable heights create the staggered masonry effect
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

type CardHeight = 'tall' | 'medium' | 'short';

interface FeatureCardProps {
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  height?: CardHeight;
  onPress?: () => void;
}

const HEIGHT_MAP: Record<CardHeight, number> = {
  tall: 200,
  medium: 160,
  short: 130,
};

export default function FeatureCard({
  title,
  subtitle,
  icon,
  accentColor,
  height = 'medium',
  onPress,
}: FeatureCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { height: HEIGHT_MAP[height] }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Icon circle */}
      <View style={[styles.iconCircle, { backgroundColor: `${accentColor}20` }]}>
        <Ionicons name={icon as any} size={22} color={accentColor} />
      </View>

      {/* Content pushed to bottom */}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.5)',
  },
});
