/**
 * ChatSuggestionsScreen Component
 * Based on mockup 12 - Chat with AI suggestions
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

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
        <Stop offset="0%" stopColor="#B3E5FC" stopOpacity="0.9" />
        <Stop offset="100%" stopColor="#81D4FA" stopOpacity="0.5" />
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
    <View style={styles.container}>
      {/* Main Card */}
      <View style={[styles.mainCard, { marginTop: insets.top + 20 }]}>
        {/* Top Actions */}
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.actionButton} onPress={onExpandPress}>
            <Ionicons name="expand-outline" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onExternalPress}>
            <Ionicons name="open-outline" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onMenuPress}>
            <Ionicons name="menu" size={20} color="#666" />
          </TouchableOpacity>
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
            <TouchableOpacity
              key={suggestion.id}
              style={styles.suggestionItem}
              onPress={() => onSuggestionPress?.(suggestion)}
              activeOpacity={0.7}
            >
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark" size={16} color="#666" />
              </View>
              <Text style={styles.suggestionText}>{suggestion.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Think, ask, chat */}
        <Text style={styles.thinkAskChat}>Think, ask, chat</Text>

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
        Chat-based AI with speaking options.
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
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 16,
    fontFamily: 'Outfit-Medium',
  },
  suggestedLabel: {
    fontSize: 14,
    color: '#E8A0A0',
    marginBottom: 16,
    fontFamily: 'Outfit-Medium',
  },
  suggestionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 16,
    color: '#1A1A1A',
    flex: 1,
    fontFamily: 'Outfit-Regular',
  },
  thinkAskChat: {
    fontSize: 14,
    color: '#E8A0A0',
    marginBottom: 16,
    fontFamily: 'Outfit-Medium',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 25,
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
