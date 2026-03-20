/**
 * InterventionIndicator Component
 * Shows active intervention guidance type as a subtle badge
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { InterventionDecision } from '@/utils/interventions';

type Props = {
  intervention: InterventionDecision | null;
  isActive: boolean;
};

export default function InterventionIndicator({ intervention, isActive }: Props) {
  if (!intervention || !isActive) return null;

  const label = intervention.type.replace(/_/g, ' ');

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      <Text style={styles.text}>guidance: {label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    backgroundColor: 'rgba(135, 206, 235, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 8,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    color: 'rgba(70, 130, 180, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
