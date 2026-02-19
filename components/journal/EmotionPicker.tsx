/**
 * EmotionPicker Component - Light Theme
 * Horizontal scrollable row of emotion pills with soft shadows
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LIGHT_THEME, CARD_SHADOW_LIGHT } from '@/components/common/LightGradient';

interface Emotion {
  id: string;
  label: string;
  emoji: string;
}

const EMOTIONS: Emotion[] = [
  { id: 'happy', label: 'Happy', emoji: '😊' },
  { id: 'calm', label: 'Calm', emoji: '😌' },
  { id: 'anxious', label: 'Anxious', emoji: '😰' },
  { id: 'sad', label: 'Sad', emoji: '😢' },
  { id: 'angry', label: 'Angry', emoji: '😠' },
  { id: 'grateful', label: 'Grateful', emoji: '🙏' },
  { id: 'neutral', label: 'Neutral', emoji: '😐' },
];

interface EmotionPickerProps {
  selected: string | null;
  onSelect: (emotion: string, emoji: string) => void;
}

export default function EmotionPicker({ selected, onSelect }: EmotionPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {EMOTIONS.map((emotion) => {
        const isSelected = selected === emotion.id;
        return (
          <Pressable
            key={emotion.id}
            style={[styles.pill, isSelected && styles.pillSelected]}
            onPress={() => onSelect(emotion.id, emotion.emoji)}
          >
            <Text style={styles.emoji}>{emotion.emoji}</Text>
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {emotion.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export { EMOTIONS };

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...CARD_SHADOW_LIGHT,
  },
  pillSelected: {
    backgroundColor: LIGHT_THEME.accentLight,
  },
  emoji: {
    fontSize: 18,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textSecondary,
  },
  labelSelected: {
    color: LIGHT_THEME.textPrimary,
  },
});
