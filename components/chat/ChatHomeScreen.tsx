/**
 * ChatHomeScreen Component - Light Theme
 * Topic cards on light pastel background
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.42;

interface TopicCard {
  id: string;
  title: string;
  subtitle: string;
  gradientColors: string[];
  bgColor: string;
}

const TOPIC_CARDS: TopicCard[] = [
  {
    id: '1',
    title: 'Calm Mind',
    subtitle: 'Relaxation',
    gradientColors: ['#7FFFD4', '#58C898', '#38A878'],
    bgColor: LIGHT_THEME.cardMint,
  },
  {
    id: '2',
    title: 'Reflections',
    subtitle: 'Self-discovery',
    gradientColors: ['#D8B0F0', '#B888D8', '#9868B8'],
    bgColor: LIGHT_THEME.cardPurple,
  },
  {
    id: '3',
    title: 'Sleep Better',
    subtitle: 'Rest & Recovery',
    gradientColors: ['#88C8F8', '#5898D0', '#3878B0'],
    bgColor: LIGHT_THEME.cardBlue,
  },
  {
    id: '4',
    title: 'Anxiety Relief',
    subtitle: 'Coping',
    gradientColors: ['#F0A888', '#D08868', '#B06848'],
    bgColor: LIGHT_THEME.cardPeach,
  },
];

interface ChatHomeScreenProps {
  username?: string;
  onTopicPress?: (topic: TopicCard) => void;
  onProfilePress?: () => void;
  onSendMessage?: (message: string) => void;
  onMicPress?: () => void;
}

const GradientOrb = ({ colors, size = 80 }: { colors: string[]; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <RadialGradient id="orbGrad" cx="50%" cy="50%" rx="50%" ry="50%">
        <Stop offset="0%" stopColor={colors[0]} stopOpacity="0.9" />
        <Stop offset="50%" stopColor={colors[1]} stopOpacity="0.7" />
        <Stop offset="100%" stopColor={colors[2]} stopOpacity="0.3" />
      </RadialGradient>
    </Defs>
    <Circle cx="50" cy="50" r="48" fill="url(#orbGrad)" />
  </Svg>
);

export default function ChatHomeScreen({
  username = 'James',
  onTopicPress,
  onProfilePress,
  onSendMessage,
  onMicPress,
}: ChatHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = React.useState('');

  const handleSend = () => {
    if (inputText.trim() && onSendMessage) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const renderTopicCard = ({ item }: { item: TopicCard }) => (
    <Pressable
      style={[styles.topicCard, { backgroundColor: item.bgColor }]}
      onPress={() => onTopicPress?.(item)}
    >
      <View style={styles.orbContainer}>
        <GradientOrb colors={item.gradientColors} size={80} />
      </View>
      <Text style={styles.topicTitle}>{item.title}</Text>
      <Text style={styles.topicSubtitle}>{item.subtitle}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi {username}</Text>
        <Pressable style={styles.profileButton} onPress={onProfilePress}>
          <Ionicons name="person-outline" size={20} color={LIGHT_THEME.textSecondary} />
        </Pressable>
      </View>

      {/* Topic Cards */}
      <FlatList
        data={TOPIC_CARDS}
        renderItem={renderTopicCard}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.topicList}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
      />

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Input Bar */}
      <View style={[styles.inputContainer, { marginBottom: 120 }]}>
        <TextInput
          style={styles.input}
          placeholder="Start typing..."
          placeholderTextColor={LIGHT_THEME.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
        />
        <Pressable style={styles.micButton} onPress={onMicPress}>
          <Ionicons name="mic-outline" size={22} color={LIGHT_THEME.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LIGHT_THEME.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  topicList: {
    paddingRight: 20,
    gap: 12,
  },
  topicCard: {
    width: CARD_WIDTH,
    borderRadius: 20,
    padding: 16,
    ...CARD_SHADOW,
  },
  orbContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  topicTitle: {
    fontSize: 17,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
    marginBottom: 4,
  },
  topicSubtitle: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
  },
  spacer: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...CARD_SHADOW,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    paddingVertical: 8,
  },
  micButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
