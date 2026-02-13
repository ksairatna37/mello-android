/**
 * ChatHomeScreen Component
 * Based on mockup 13 - Chat home with topic cards
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.42;

interface TopicCard {
  id: string;
  title: string;
  subtitle: string;
  gradientColors: string[];
}

const TOPIC_CARDS: TopicCard[] = [
  {
    id: '1',
    title: 'Calm Mind',
    subtitle: 'Relaxation',
    gradientColors: ['#C8E6C9', '#A5D6A7', '#81C784'],
  },
  {
    id: '2',
    title: 'Reflections',
    subtitle: 'Self-discovery',
    gradientColors: ['#E1BEE7', '#CE93D8', '#BA68C8'],
  },
  {
    id: '3',
    title: 'Sleep Better',
    subtitle: 'Rest & Recovery',
    gradientColors: ['#B3E5FC', '#81D4FA', '#4FC3F7'],
  },
  {
    id: '4',
    title: 'Anxiety Relief',
    subtitle: 'Coping',
    gradientColors: ['#FFCCBC', '#FFAB91', '#FF8A65'],
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
    <TouchableOpacity
      style={styles.topicCard}
      onPress={() => onTopicPress?.(item)}
      activeOpacity={0.8}
    >
      <View style={styles.orbContainer}>
        <GradientOrb colors={item.gradientColors} size={80} />
      </View>
      <Text style={styles.topicTitle}>{item.title}</Text>
      <Text style={styles.topicSubtitle}>{item.subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Main Card */}
      <View style={[styles.mainCard, { marginTop: insets.top + 20 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi {username}</Text>
          <TouchableOpacity style={styles.profileButton} onPress={onProfilePress}>
            <Ionicons name="person-outline" size={22} color="#666" />
          </TouchableOpacity>
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

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <View style={styles.inputIconContainer}>
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Defs>
                <RadialGradient id="inputGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor="#B3E5FC" />
                  <Stop offset="100%" stopColor="#E1BEE7" />
                </RadialGradient>
              </Defs>
              <Circle cx="12" cy="12" r="10" fill="url(#inputGrad)" />
            </Svg>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Start typing..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.micButton} onPress={onMicPress}>
            <Ionicons name="mic-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer text */}
      <Text style={styles.footerText}>
        Empty AI chat canvas for new sessions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 20,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '600',
    color: '#E8A0A0',
    fontFamily: 'Outfit-SemiBold',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  topicCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FAFAFA',
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
  },
  orbContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  topicTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: 'Outfit-SemiBold',
  },
  topicSubtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Outfit-Regular',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 25,
    marginHorizontal: 20,
    marginTop: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputIconContainer: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 8,
    fontFamily: 'Outfit-Regular',
  },
  micButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 'auto',
    marginBottom: 40,
    fontFamily: 'Outfit-Regular',
  },
});
