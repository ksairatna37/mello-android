/**
 * DailyCheckInCard Component - Light Theme
 * White card with colorful MoodFace icons
 * Persists check-in to melloStorage + shows post-check-in response
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { addMoodCheckIn, updateStreak } from '@/utils/melloStorage';
import { MoodFaceRow, MoodType } from '@/components/home/MoodFace';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';

const POST_RESPONSES: Record<MoodType, string> = {
  great: "I'm glad you're feeling great today! 😊",
  good: "I'm glad you're feeling good today! 😊",
  okay: 'Thanks for checking in. Every day is different.',
  low: "I'm here for you. Want to talk?",
  rough: "I'm here for you. Want to talk?",
};

interface DailyCheckInCardProps {
  onMoodSelect?: (moodId: string) => void;
  onCheckInComplete?: () => void;
}

export default function DailyCheckInCard({ onMoodSelect, onCheckInComplete }: DailyCheckInCardProps) {
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<MoodType | undefined>();
  const [responseText, setResponseText] = useState<string | null>(null);

  const handleSelect = async (mood: MoodType) => {
    Vibration.vibrate(Platform.OS === 'ios' ? 10 : 50);
    setSelectedMood(mood);
    setResponseText(POST_RESPONSES[mood]);

    // Map MoodType to storage format
    const moodLabelMap: Record<MoodType, string> = {
      great: 'Great',
      good: 'Good',
      okay: 'Okay',
      low: 'Low',
      rough: 'Rough',
    };

    // Persist
    await addMoodCheckIn(mood, moodLabelMap[mood]);
    await updateStreak();

    onMoodSelect?.(mood);
    onCheckInComplete?.();
  };

  const handleTalkToMello = () => {
    router.navigate('/(main)/chat');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>How are you today?</Text>

      <MoodFaceRow
        selectedMood={selectedMood}
        onSelectMood={handleSelect}
        size={52}
      />

      {/* Post-check-in response */}
      {responseText && (
        <Animated.View style={styles.responseContainer} entering={FadeIn.duration(400)}>
          <Text style={styles.responseText}>{responseText}</Text>
          {(selectedMood === 'low' || selectedMood === 'rough') && (
            <TouchableOpacity style={styles.talkButton} onPress={handleTalkToMello}>
              <Text style={styles.talkButtonText}>Talk to Mello</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    ...CARD_SHADOW,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  responseContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: LIGHT_THEME.border,
    alignItems: 'center',
    gap: 12,
  },
  responseText: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    textAlign: 'center',
  },
  talkButton: {
    backgroundColor: LIGHT_THEME.accentLight,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  talkButtonText: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.accent,
  },
});
