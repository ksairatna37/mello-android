/**
 * RecentActivityCard Component - Light Theme
 * Colored gradient cards for recent activities with smooth animations
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LIGHT_THEME, CARD_SHADOW_LIGHT } from '@/components/common/LightGradient';

export type ActivityType = 'journal' | 'meditation' | 'mood' | 'chat' | 'call' | 'breathing';

interface RecentActivityCardProps {
  type: ActivityType;
  title: string;
  subtitle?: string;
  timestamp?: string;
  onPress?: () => void;
}

const ACTIVITY_CONFIG: Record<ActivityType, {
  color: string;
  textColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}> = {
  journal: {
    color: LIGHT_THEME.cardYellow,
    textColor: '#8B7355',
    icon: 'book-outline',
    label: 'Journal',
  },
  meditation: {
    color: LIGHT_THEME.cardPurple,
    textColor: '#6B5B95',
    icon: 'leaf-outline',
    label: 'Meditation',
  },
  mood: {
    color: LIGHT_THEME.cardMint,
    textColor: '#4A7C6F',
    icon: 'happy-outline',
    label: 'Mood',
  },
  chat: {
    color: LIGHT_THEME.cardBlue,
    textColor: '#4A6B8C',
    icon: 'chatbubble-outline',
    label: 'Chat',
  },
  call: {
    color: LIGHT_THEME.cardPeach,
    textColor: '#8B6355',
    icon: 'call-outline',
    label: 'Call',
  },
  breathing: {
    color: LIGHT_THEME.cardPink,
    textColor: '#8B5A6B',
    icon: 'fitness-outline',
    label: 'Breathing',
  },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const TIMING = { duration: 150, easing: Easing.out(Easing.ease) };

export default function RecentActivityCard({
  type,
  title,
  subtitle,
  timestamp,
  onPress,
}: RecentActivityCardProps) {
  const scale = useSharedValue(1);
  const config = ACTIVITY_CONFIG[type];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.96, TIMING);
      }}
      onPressOut={() => {
        scale.value = withTiming(1, TIMING);
      }}
      style={[
        styles.card,
        { backgroundColor: config.color },
        animatedStyle,
      ]}
    >
      {/* Category tag */}
      <View style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
        <Ionicons name={config.icon} size={12} color={config.textColor} />
        <Text style={[styles.tagText, { color: config.textColor }]}>
          {config.label}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: config.textColor }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: config.textColor }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Timestamp */}
      {timestamp && (
        <Text style={[styles.timestamp, { color: config.textColor }]}>
          {timestamp}
        </Text>
      )}
    </AnimatedPressable>
  );
}

// Grid of recent activities (2-column)
interface RecentActivitiesGridProps {
  activities: Array<{
    id: string;
    type: ActivityType;
    title: string;
    subtitle?: string;
    timestamp?: string;
  }>;
  onActivityPress?: (id: string) => void;
}

export function RecentActivitiesGrid({ activities, onActivityPress }: RecentActivitiesGridProps) {
  return (
    <View style={styles.grid}>
      {activities.map((activity) => (
        <RecentActivityCard
          key={activity.id}
          type={activity.type}
          title={activity.title}
          subtitle={activity.subtitle}
          timestamp={activity.timestamp}
          onPress={() => onActivityPress?.(activity.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    minHeight: 110,
    justifyContent: 'space-between',
    ...CARD_SHADOW_LIGHT,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  tagText: {
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
    opacity: 0.8,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: 'Outfit-Regular',
    opacity: 0.6,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
