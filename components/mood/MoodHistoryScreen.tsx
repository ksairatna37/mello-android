/**
 * MoodHistoryScreen Component - Light Theme
 * Clean mood trend chart with white cards
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

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

  const paddingTop = insets.top + 12;
  const subtitleH = useSharedValue(16);
  const subtitleOpacity = useSharedValue(1);
  const headerSubtitleText = 'Mood History';

  const subtitleAnimStyle = useAnimatedStyle(() => ({
    height: subtitleH.value,
    opacity: subtitleOpacity.value,
    overflow: 'hidden',
  }));

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
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop }]}>
          <Pressable style={styles.headerBtn} hitSlop={8} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.logoText}>mello</Text>
            <Animated.View style={subtitleAnimStyle}>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {headerSubtitleText}
              </Text>
            </Animated.View>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <View style={[
          styles.scrollContent,
          { paddingBottom: 120 },
        ]}>
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
        </View>
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerSpacer: {
    width: 40,
    height: 40,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  logoText: {
    fontFamily: 'Playwrite',
    fontSize: 26,
    color: '#1A1A1A',
    lineHeight: 32,
    marginBottom: 10,
  },

  headerSubtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    marginTop: 1,
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
