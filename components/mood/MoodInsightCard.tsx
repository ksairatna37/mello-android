/**
 * MoodInsightCard Component - Light Theme
 * Shows AI-generated insight about mood trends
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import type { MoodCheckIn } from '@/utils/melloStorage';

interface MoodInsightCardProps {
  checkIns: MoodCheckIn[];
  period: 'weekly' | 'monthly';
}

const MOOD_SCORES: Record<string, number> = {
  great: 5,
  good: 4,
  okay: 3,
  low: 2,
  rough: 1,
};

function getAvgScore(items: MoodCheckIn[]): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, c) => sum + (MOOD_SCORES[c.moodId] ?? 3), 0);
  return total / items.length;
}

export default function MoodInsightCard({ checkIns, period }: MoodInsightCardProps) {
  const insight = useMemo(() => {
    const days = period === 'weekly' ? 7 : 30;
    const now = new Date();

    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - days);
    const currentStr = currentStart.toISOString().split('T')[0];

    const prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - days);
    const prevStr = prevStart.toISOString().split('T')[0];

    const current = checkIns.filter((c) => c.date >= currentStr);
    const previous = checkIns.filter((c) => c.date >= prevStr && c.date < currentStr);

    if (current.length === 0) {
      return {
        text: 'Start checking in daily to see your mood trends!',
        icon: 'sparkles-outline' as const,
        color: LIGHT_THEME.accent,
      };
    }

    const currentAvg = getAvgScore(current);
    const prevAvg = getAvgScore(previous);

    if (previous.length === 0) {
      return {
        text: `You've checked in ${current.length} time${current.length > 1 ? 's' : ''} this ${period === 'weekly' ? 'week' : 'month'}. Keep it up!`,
        icon: 'trending-up-outline' as const,
        color: LIGHT_THEME.accent,
      };
    }

    const change = ((currentAvg - prevAvg) / prevAvg) * 100;

    if (change > 5) {
      return {
        text: `Your mood improved ${Math.round(Math.abs(change))}% this ${period === 'weekly' ? 'week' : 'month'}! Keep it up!`,
        icon: 'trending-up-outline' as const,
        color: '#4CAF50',
      };
    } else if (change < -5) {
      return {
        text: `Your mood dipped a bit this ${period === 'weekly' ? 'week' : 'month'}. I'm here for you.`,
        icon: 'heart-outline' as const,
        color: '#64B5F6',
      };
    } else {
      return {
        text: `Your mood has been consistent. That's great stability!`,
        icon: 'shield-checkmark-outline' as const,
        color: LIGHT_THEME.accent,
      };
    }
  }, [checkIns, period]);

  return (
    <View style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: `${insight.color}20` }]}>
        <Ionicons name={insight.icon as any} size={20} color={insight.color} />
      </View>
      <Text style={styles.text}>{insight.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...CARD_SHADOW,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    lineHeight: 20,
  },
});
