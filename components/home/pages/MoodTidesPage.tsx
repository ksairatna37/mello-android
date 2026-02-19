/**
 * MoodTidesPage - "Mood Tides" (Mood History) tab content
 * Mood trends chart + recent check-ins
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import { getMoodCheckIns, MoodCheckIn } from '@/utils/melloStorage';

function getFormattedDate(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
}

function formatCheckInDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const MOOD_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  great: { emoji: '😊', label: 'Great', color: '#F5DEB3' },
  good: { emoji: '🙂', label: 'Good', color: '#FFCC80' },
  neutral: { emoji: '😐', label: 'Okay', color: '#CE93D8' },
  okay: { emoji: '😐', label: 'Okay', color: '#CE93D8' },
  sad: { emoji: '😔', label: 'Low', color: '#80CBC4' },
  low: { emoji: '😔', label: 'Low', color: '#80CBC4' },
  angry: { emoji: '😤', label: 'Rough', color: '#F48FB1' },
  rough: { emoji: '😤', label: 'Rough', color: '#F48FB1' },
};

export default function MoodTidesPage() {
  const router = useRouter();
  const [checkIns, setCheckIns] = useState<MoodCheckIn[]>([]);
  const [weeklyMoods, setWeeklyMoods] = useState<(MoodCheckIn | null)[]>([]);
  const formattedDate = getFormattedDate();

  useEffect(() => {
    const loadCheckIns = async () => {
      const moods = await getMoodCheckIns();
      setCheckIns(moods.slice(-10).reverse());

      // Get last 7 days
      const week: (MoodCheckIn | null)[] = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const found = moods.find((m) => m.date.startsWith(dateStr));
        week.push(found || null);
      }
      setWeeklyMoods(week);
    };
    loadCheckIns();
  }, []);

  const handleViewFullHistory = useCallback(() => {
    router.navigate('/(main)/mood-history');
  }, [router]);

  const getDayLabel = (index: number): string => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const today = new Date();
    const dayIndex = new Date(today.setDate(today.getDate() - (6 - index))).getDay();
    return days[dayIndex];
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <Animated.View style={styles.headerSection} entering={FadeInUp.delay(100).duration(400)}>
        <Text style={styles.pageTitle}>Mood Tides</Text>
        <Text style={styles.pageSubtitle}>{formattedDate}</Text>
      </Animated.View>

      {/* Weekly Overview */}
      <Animated.View style={styles.weeklyCard} entering={FadeInUp.delay(200).duration(400)}>
        <Text style={styles.cardTitle}>This Week</Text>
        <View style={styles.weekRow}>
          {weeklyMoods.map((mood, index) => {
            const config = mood ? MOOD_CONFIG[mood.moodId] || MOOD_CONFIG.neutral : null;
            const isToday = index === 6;

            return (
              <View key={index} style={styles.dayColumn}>
                <View
                  style={[
                    styles.moodCircle,
                    config && { backgroundColor: config.color },
                    !config && styles.moodCircleEmpty,
                    isToday && styles.moodCircleToday,
                  ]}
                >
                  {config ? (
                    <Text style={styles.moodEmoji}>{config.emoji}</Text>
                  ) : (
                    <Ionicons name="remove" size={16} color={LIGHT_THEME.textMuted} />
                  )}
                </View>
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                  {getDayLabel(index)}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* Mood Insight */}
      <Animated.View style={styles.insightCard} entering={FadeInUp.delay(300).duration(400)}>
        <View style={styles.insightIcon}>
          <Ionicons name="analytics" size={20} color={LIGHT_THEME.accent} />
        </View>
        <Text style={styles.insightTitle}>Your Pattern</Text>
        <Text style={styles.insightText}>
          {checkIns.length >= 3
            ? "You've been checking in regularly. Keep it up!"
            : "Check in more often to see your mood patterns."}
        </Text>
      </Animated.View>

      {/* Recent Check-ins */}
      {checkIns.length > 0 && (
        <Animated.View style={styles.checkInsSection} entering={FadeInUp.delay(400).duration(400)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Check-ins</Text>
            <Pressable onPress={handleViewFullHistory}>
              <Text style={styles.viewAllText}>View all</Text>
            </Pressable>
          </View>

          {checkIns.slice(0, 5).map((checkIn, index) => {
            const config = MOOD_CONFIG[checkIn.moodId] || MOOD_CONFIG.neutral;

            return (
              <View key={checkIn.id || index} style={styles.checkInRow}>
                <View style={[styles.checkInMood, { backgroundColor: config.color }]}>
                  <Text style={styles.checkInEmoji}>{config.emoji}</Text>
                </View>
                <View style={styles.checkInInfo}>
                  <Text style={styles.checkInLabel}>{config.label}</Text>
                  <Text style={styles.checkInDate}>{formatCheckInDate(checkIn.date)}</Text>
                </View>
                              </View>
            );
          })}
        </Animated.View>
      )}

      {/* Empty State */}
      {checkIns.length === 0 && (
        <Animated.View style={styles.emptyState} entering={FadeInUp.delay(400).duration(400)}>
          <Ionicons name="analytics-outline" size={48} color={LIGHT_THEME.textMuted} />
          <Text style={styles.emptyTitle}>No check-ins yet</Text>
          <Text style={styles.emptyText}>
            Start tracking your mood to see patterns over time.
          </Text>
        </Animated.View>
      )}
    </ScrollView>
  );
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
  weeklyCard: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    ...CARD_SHADOW,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
    gap: 8,
  },
  moodCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodCircleEmpty: {
    backgroundColor: LIGHT_THEME.border,
  },
  moodCircleToday: {
    borderWidth: 2,
    borderColor: LIGHT_THEME.accent,
  },
  moodEmoji: {
    fontSize: 20,
  },
  dayLabel: {
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
  },
  dayLabelToday: {
    color: LIGHT_THEME.accent,
    fontFamily: 'Outfit-SemiBold',
  },
  insightCard: {
    backgroundColor: LIGHT_THEME.accentLight,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  insightIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LIGHT_THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  insightText: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
  },
  checkInsSection: {
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
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    ...CARD_SHADOW,
  },
  checkInMood: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInEmoji: {
    fontSize: 20,
  },
  checkInInfo: {
    flex: 1,
  },
  checkInLabel: {
    fontSize: 15,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textPrimary,
  },
  checkInDate: {
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textMuted,
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
});
