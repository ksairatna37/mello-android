/**
 * LoveNotesPage - "Love Notes" (Journal) tab content
 * Journal entries preview + quick add action
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import JournalQuickAction from '@/components/home/JournalQuickAction';
import { getJournalEntries, JournalEntry } from '@/utils/melloStorage';

function getFormattedDate(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
}

function formatEntryDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LoveNotesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const formattedDate = getFormattedDate();

  useEffect(() => {
    const loadEntries = async () => {
      const journalEntries = await getJournalEntries();
      // Get most recent 5 entries
      setEntries(journalEntries.slice(-5).reverse());
    };
    loadEntries();
  }, []);

  const handleNewEntry = useCallback(() => {
    router.navigate('/(main)/journal');
  }, [router]);

  const handleEntryPress = useCallback((entry: JournalEntry) => {
    router.navigate('/(main)/journal');
  }, [router]);

  const handleViewAll = useCallback(() => {
    router.navigate('/(main)/journal');
  }, [router]);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <Animated.View style={styles.headerSection} entering={FadeInUp.delay(100).duration(400)}>
        <Text style={styles.pageTitle}>Positive Notes</Text>
        <Text style={styles.pageSubtitle}>{formattedDate}</Text>
      </Animated.View>

      {/* Quick Add */}
      <Animated.View entering={FadeInUp.delay(200).duration(400)}>
        <JournalQuickAction onPress={handleNewEntry} />
      </Animated.View>

      {/* Journal Prompt */}
      <Animated.View style={styles.promptCard} entering={FadeInUp.delay(300).duration(400)}>
        <View style={styles.promptIcon}>
          <Ionicons name="heart" size={20} color="#E57373" />
        </View>
        <Text style={styles.promptTitle}>Today's Prompt</Text>
        <Text style={styles.promptText}>
          What made you smile today, even if just for a moment?
        </Text>
      </Animated.View>

      {/* Recent Entries */}
      {entries.length > 0 && (
        <Animated.View style={styles.entriesSection} entering={FadeInUp.delay(400).duration(400)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Notes</Text>
            <Pressable onPress={handleViewAll}>
              <Text style={styles.viewAllText}>View all</Text>
            </Pressable>
          </View>

          {entries.map((entry, index) => (
            <Pressable
              key={entry.id}
              style={styles.entryCard}
              onPress={() => handleEntryPress(entry)}
            >
              <View style={styles.entryHeader}>
                <Text style={styles.entryDate}>{formatEntryDate(entry.createdAt)}</Text>
                {entry.emotion && (
                  <View style={[styles.emotionBadge, { backgroundColor: getEmotionColor(entry.emotion) }]}>
                    <Text style={styles.emotionText}>{entry.emotion}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.entryPreview} numberOfLines={2}>
                {entry.content || 'No content'}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      )}

      {/* Empty State */}
      {entries.length === 0 && (
        <Animated.View style={styles.emptyState} entering={FadeInUp.delay(400).duration(400)}>
          <Ionicons name="book-outline" size={48} color={LIGHT_THEME.textMuted} />
          <Text style={styles.emptyTitle}>No notes yet</Text>
          <Text style={styles.emptyText}>
            Start writing to capture your thoughts and feelings.
          </Text>
        </Animated.View>
      )}

      {/* Hint */}
      <Animated.View style={styles.hintCard} entering={FadeInUp.delay(500).duration(400)}>
        <Text style={styles.hintText}>
          Writing helps process emotions and build self-awareness.
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

function getEmotionColor(emotion: string): string {
  const colors: Record<string, string> = {
    happy: '#FFF9C4',
    grateful: '#E1F5FE',
    calm: '#E8F5E9',
    anxious: '#FFF3E0',
    sad: '#E3F2FD',
    angry: '#FFEBEE',
  };
  return colors[emotion.toLowerCase()] || LIGHT_THEME.accentLight;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 20,
  },
  headerSection: {
    marginTop: 8,
  },
  pageTitle: {
    fontSize: 36,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    marginTop: 4,
  },
  promptCard: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    ...CARD_SHADOW,
  },
  promptIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptTitle: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  promptText: {
    fontSize: 18,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    textAlign: 'center',
    lineHeight: 26,
  },
  entriesSection: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.accent,
  },
  entryCard: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    ...CARD_SHADOW,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryDate: {
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
  },
  emotionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emotionText: {
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textPrimary,
    textTransform: 'capitalize',
  },
  entryPreview: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    textAlign: 'center',
  },
  hintCard: {
    backgroundColor: LIGHT_THEME.accentLight,
    borderRadius: 16,
    padding: 16,
  },
  hintText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
