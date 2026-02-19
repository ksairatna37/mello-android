/**
 * JournalEntryCard Component - Light Theme
 * White card showing journal entry preview with soft shadows
 */

import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import type { JournalEntry } from '@/utils/melloStorage';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onPress: () => void;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStr = date.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (dateStr === todayStr) return `Today, ${time}`;
  if (dateStr === yesterdayStr) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

export default function JournalEntryCard({ entry, onPress }: JournalEntryCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.headerRow}>
        <Text style={styles.timestamp}>{formatTimestamp(entry.createdAt)}</Text>
        <View style={styles.emotionBadge}>
          <Text style={styles.emotionEmoji}>{entry.emotionEmoji}</Text>
          <Text style={styles.emotionLabel}>{entry.emotion}</Text>
        </View>
      </View>

      <Text style={styles.content} numberOfLines={2}>
        {entry.content}
      </Text>

      {entry.photoUri && (
        <Image source={{ uri: entry.photoUri }} style={styles.photoThumb} />
      )}

      {entry.prompt && (
        <Text style={styles.promptTag}>Prompted</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    ...CARD_SHADOW,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textMuted,
  },
  emotionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LIGHT_THEME.accentLight,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  emotionEmoji: {
    fontSize: 14,
  },
  emotionLabel: {
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textSecondary,
    textTransform: 'capitalize',
  },
  content: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    lineHeight: 22,
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  promptTag: {
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
