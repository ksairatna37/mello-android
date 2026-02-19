/**
 * MyVibesPage - "My Vibes" tab content
 * Today's vibe, mood cards, affirmation, streak display
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import { VibeCardsRow, VibeMood } from '@/components/home/VibeCard';
import { getOnboardingData } from '@/utils/onboardingStorage';
import { hasCheckedInToday, getCheckInStreak, getMoodCheckIns } from '@/utils/melloStorage';

// Daily affirmations
const AFFIRMATIONS = [
  'You are exactly where you need to be.',
  'Your feelings are valid, always.',
  'Small steps still move you forward.',
  'You are worthy of rest and peace.',
  'Today is a new chance to be kind to yourself.',
  'Healing is not linear, and that\'s okay.',
  'You are stronger than you think.',
  'It\'s okay to not have all the answers.',
  'Your presence in this world matters.',
  'Be gentle with yourself today.',
  'You don\'t have to be perfect to be amazing.',
  'Every breath is a fresh beginning.',
  'You are allowed to take up space.',
  'Progress, not perfection.',
  'You are doing better than you think.',
];

function getDailyAffirmation(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length];
}

function getFormattedDate(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
}

function getCurrentTime(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes}${ampm}`;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function mapToVibeMood(moodId: string): VibeMood {
  const map: Record<string, VibeMood> = {
    great: 'happy',
    good: 'grateful',
    neutral: 'neutral',
    okay: 'calm',
    sad: 'sad',
    angry: 'anxious',
    low: 'tired',
    rough: 'anxious',
  };
  return map[moodId] || 'neutral';
}

export default function MyVibesPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState<string>('');
  const [userMood, setUserMood] = useState<VibeMood>('neutral');
  const [checkedIn, setCheckedIn] = useState(false);
  const [streakCount, setStreakCount] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const data = await getOnboardingData();
      if (data.firstName) setFirstName(data.firstName);

      const checked = await hasCheckedInToday();
      setCheckedIn(checked);

      const streak = await getCheckInStreak();
      setStreakCount(streak.currentStreak);

      const moods = await getMoodCheckIns();
      if (moods.length > 0) {
        const latestMood = moods[moods.length - 1];
        setUserMood(mapToVibeMood(latestMood.moodId));
      }
    };
    loadData();
  }, []);

  const affirmation = useMemo(() => getDailyAffirmation(), []);
  const formattedDate = useMemo(() => getFormattedDate(), []);
  const currentTime = useMemo(() => getCurrentTime(), []);
  const greeting = useMemo(() => getTimeBasedGreeting(), []);

  const handleUserCardPress = useCallback(() => {
    router.navigate('/(main)/mood-history');
  }, [router]);

  const handleCompanionCardPress = useCallback(() => {
    router.navigate('/(main)/chat');
  }, [router]);

  const getMelloMood = (): VibeMood => {
    if (!checkedIn) return 'connected';
    if (userMood === 'sad' || userMood === 'anxious') return 'calm';
    return 'energized';
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {/* Greeting Section */}
      <Animated.View style={styles.vibeSection} entering={FadeInUp.delay(100).duration(400)}>
        <Text style={styles.vibeTitle}>{greeting}{firstName ? `, ${firstName}` : ''}</Text>
        <Text style={styles.vibeDate}>{formattedDate}</Text>
      </Animated.View>

      {/* Mood Cards Row */}
      <Animated.View style={styles.cardsSection} entering={FadeInUp.delay(200).duration(400)}>
        <VibeCardsRow
          userMood={checkedIn ? userMood : 'neutral'}
          companionMood={getMelloMood()}
          userName={firstName || 'You'}
          onUserCardPress={handleUserCardPress}
          onCompanionCardPress={handleCompanionCardPress}
        />
      </Animated.View>

      {/* Check-in Prompt */}
      {!checkedIn && (
        <Animated.View style={styles.promptCard} entering={FadeInUp.delay(300).duration(400)}>
          <Text style={styles.promptText}>
            Tap your card to check in and share how you're feeling today.
          </Text>
        </Animated.View>
      )}

      {/* Activity / Affirmation */}
      <Animated.View style={styles.activitySection} entering={FadeInUp.delay(400).duration(400)}>
        <View style={styles.activityHeader}>
          <View style={styles.activityAvatar}>
            <Ionicons name="sparkles" size={16} color={LIGHT_THEME.accent} />
          </View>
          <Text style={styles.activityTime}>{currentTime}</Text>
        </View>
        <Text style={styles.quoteText}>"{affirmation}"</Text>
      </Animated.View>

      {/* Streak Display */}
      {streakCount >= 3 && (
        <Animated.View style={styles.streakCard} entering={FadeInUp.delay(500).duration(400)}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakText}>
            {streakCount}-day check-in streak! Keep going!
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
  vibeSection: {
    marginTop: 8,
  },
  vibeTitle: {
    fontSize: 36,
    fontFamily: 'Outfit-Regular',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  vibeDate: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  cardsSection: {
    marginTop: 8,
  },
  promptCard: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 16,
    padding: 16,
    ...CARD_SHADOW,
  },
  promptText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    textAlign: 'center',
  },
  activitySection: {
    gap: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LIGHT_THEME.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTime: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.7)',
  },
  quoteText: {
    fontSize: 22,
    fontFamily: 'Outfit-Light',
    color: '#FFFFFF',
    lineHeight: 30,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    ...CARD_SHADOW,
  },
  streakEmoji: {
    fontSize: 22,
  },
  streakText: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: '#8B6914',
    flex: 1,
  },
});
