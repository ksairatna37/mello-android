/**
 * ChatSuggestionsScreen Component - Light Theme
 * AI suggestions on light pastel background
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';

interface Suggestion {
  id: string;
  text: string;
}

const SUGGESTIONS: Suggestion[] = [
  { id: '1', text: 'Help me understand my feelings.' },
  { id: '2', text: 'I need someone to talk to.' },
  { id: '3', text: 'What should I do when I feel anxious?' },
];

interface ChatSuggestionsScreenProps {
  username?: string;
  onSuggestionPress?: (suggestion: Suggestion) => void;
  onExpandPress?: () => void;
  onExternalPress?: () => void;
  onMenuPress?: () => void;
  onSendMessage?: (message: string) => void;
  onMicPress?: () => void;
}

const AIAvatar = () => (
  <Svg width={48} height={48} viewBox="0 0 48 48">
    <Defs>
      <RadialGradient id="avatarGrad" cx="50%" cy="50%" rx="50%" ry="50%">
        <Stop offset="0%" stopColor="#E8DAFF" stopOpacity="0.9" />
        <Stop offset="100%" stopColor="#B9A6FF" stopOpacity="0.5" />
      </RadialGradient>
    </Defs>
    <Circle cx="24" cy="24" r="22" fill="url(#avatarGrad)" />
  </Svg>
);

export default function ChatSuggestionsScreen({
  username = 'Alex',
  onSuggestionPress,
  onExpandPress,
  onExternalPress,
  onMenuPress,
  onSendMessage,
  onMicPress,
}: ChatSuggestionsScreenProps) {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = React.useState('');

  const handleSend = () => {
    if (inputText.trim() && onSendMessage) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Top Actions */}
      <View style={styles.topActions}>
        <Pressable style={styles.actionButton} onPress={onExpandPress}>
          <Ionicons name="expand-outline" size={20} color={LIGHT_THEME.textSecondary} />
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onExternalPress}>
          <Ionicons name="open-outline" size={20} color={LIGHT_THEME.textSecondary} />
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onMenuPress}>
          <Ionicons name="arrow-back" size={20} color={LIGHT_THEME.textSecondary} />
        </Pressable>
      </View>

      {/* AI Avatar */}
      <View style={styles.avatarContainer}>
        <AIAvatar />
      </View>

      {/* Greeting */}
      <Text style={styles.greeting}>
        Hi {username}! How can I help you today?
      </Text>

      {/* AI Suggested Label */}
      <Text style={styles.suggestedLabel}>AI suggested</Text>

      {/* Suggestions */}
      <View style={styles.suggestionsContainer}>
        {SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion.id}
            style={styles.suggestionItem}
            onPress={() => onSuggestionPress?.(suggestion)}
          >
            <View style={styles.checkIcon}>
              <Ionicons name="checkmark" size={16} color={LIGHT_THEME.accent} />
            </View>
            <Text style={styles.suggestionText}>{suggestion.text}</Text>
          </Pressable>
        ))}
      </View>

      {/* Think, ask, chat */}
      <Text style={styles.thinkAskChat}>Think, ask, chat</Text>

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
    paddingHorizontal: 24,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 20,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIGHT_THEME.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  greeting: {
    fontSize: 20,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textPrimary,
    marginBottom: 20,
  },
  suggestedLabel: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
    marginBottom: 16,
  },
  suggestionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LIGHT_THEME.surface,
    padding: 14,
    borderRadius: 16,
    ...CARD_SHADOW,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LIGHT_THEME.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    flex: 1,
  },
  thinkAskChat: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
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
