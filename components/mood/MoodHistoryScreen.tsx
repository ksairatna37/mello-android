/**
 * MoodHistoryScreen Component - Light Theme
 * Clean mood trend chart with white cards
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import LightGradient, { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import MoodTrendChart from './MoodTrendChart';
import MoodInsightCard from './MoodInsightCard';
import { getMoodScores, getMoodCheckIns } from '@/utils/melloStorage';
import type { MoodCheckIn } from '@/utils/melloStorage';

const MOOD_EMOJIS: Record<string, string> = {
  great: '😊',
  good: '👍',
  okay: '😐',
  low: '😢',
  rough: '⛈️',
};

type Period = 'weekly' | 'monthly';

export default function MoodHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('weekly');
  const [chartData, setChartData] = useState<{ date: string; score: number }[]>([]);
  const [allCheckIns, setAllCheckIns] = useState<MoodCheckIn[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<MoodCheckIn[]>([]);

  const loadData = useCallback(async () => {
    const days = period === 'weekly' ? 7 : 30;
    const scores = await getMoodScores(days);
    setChartData(scores);

    const all = await getMoodCheckIns();
    setAllCheckIns(all);
    setRecentCheckIns(all.slice(0, 10));
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function formatCheckInDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LightGradient variant="cool" />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: 120 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={LIGHT_THEME.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Mood History</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Period Toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleButton, period === 'weekly' && styles.toggleActive]}
            onPress={() => setPeriod('weekly')}
          >
            <Text style={[styles.toggleText, period === 'weekly' && styles.toggleTextActive]}>
              Weekly
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, period === 'monthly' && styles.toggleActive]}
            onPress={() => setPeriod('monthly')}
          >
            <Text style={[styles.toggleText, period === 'monthly' && styles.toggleTextActive]}>
              Monthly
            </Text>
          </Pressable>
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          <MoodTrendChart data={chartData} period={period} />
        </View>

        {/* Insight */}
        <MoodInsightCard checkIns={allCheckIns} period={period} />

        {/* Recent Check-ins */}
        {recentCheckIns.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>RECENT CHECK-INS</Text>
            {recentCheckIns.map((checkIn) => (
              <View key={checkIn.id} style={styles.checkInItem}>
                <Text style={styles.checkInEmoji}>
                  {MOOD_EMOJIS[checkIn.moodId] ?? '😐'}
                </Text>
                <View style={styles.checkInContent}>
                  <Text style={styles.checkInMood}>{checkIn.moodLabel}</Text>
                  <Text style={styles.checkInDate}>{formatCheckInDate(checkIn.date)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 18,
    ...CARD_SHADOW,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 16,
    padding: 4,
    ...CARD_SHADOW,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: LIGHT_THEME.accent,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },

  // Chart
  chartCard: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 24,
    padding: 16,
    paddingBottom: 8,
    ...CARD_SHADOW,
  },

  // Recent
  recentSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
  checkInItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 16,
    padding: 14,
    ...CARD_SHADOW,
  },
  checkInEmoji: {
    fontSize: 24,
  },
  checkInContent: {
    flex: 1,
    gap: 2,
  },
  checkInMood: {
    fontSize: 15,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textPrimary,
  },
  checkInDate: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textMuted,
  },
});
