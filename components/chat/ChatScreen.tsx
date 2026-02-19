/**
 * ChatScreen Component
 * Clean minimal chat matching web's TextChat.tsx design
 * Gradient bubbles, avatars, typewriter animation, pill input
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

import { detectCrisis, callCrisisLine } from '@/utils/crisisDetection';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import TypewriterText from './TypewriterText';
import LoadingDots from './LoadingDots';
import MessageAvatar from './MessageAvatar';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatScreenProps {
  username?: string;
}

// ═══════════════════════════════════════════════════
// SIMULATED RESPONSES
// ═══════════════════════════════════════════════════

function getSimulatedResponse(input: string): string {
  const responses = [
    "I hear you, and I'm really glad you shared that with me. Want to tell me more about what's going on?",
    "That sounds like a lot to carry. It's okay to feel this way. How have you been coping?",
    "Thanks for opening up to me! It takes courage to talk about these things. What would feel helpful right now?",
    "I'm here for you. Sometimes just talking about things can help lighten the load. What else is on your mind?",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function ChatScreen({ username = 'Friend' }: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCrisisResources, setShowCrisisResources] = useState(false);
  const [displayedMessageIds, setDisplayedMessageIds] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  // Send welcome message on mount
  useEffect(() => {
    const welcomeMsg: Message = {
      id: 'welcome',
      text: "Hey! I'm Mello. I'm here whenever you want to talk, vent, or just think out loud. What's on your mind?",
      isUser: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMsg]);
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    if (detectCrisis(inputText)) {
      setShowCrisisResources(true);
    }

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: getSimulatedResponse(inputText),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  }, [inputText, isLoading]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isLoading]);

  const handleTypewriterComplete = useCallback((id: string) => {
    setDisplayedMessageIds(prev => new Set(prev).add(id));
  }, []);

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isNew = !item.isUser && !displayedMessageIds.has(item.id);
    const initial = username.charAt(0);

    return (
      <View style={[styles.messageRow, item.isUser ? styles.messageRowUser : styles.messageRowAI]}>
        {/* AI avatar on left */}
        {!item.isUser && (
          <View style={styles.avatarContainer}>
            <MessageAvatar type="ai" size={40} />
          </View>
        )}

        {/* Bubble */}
        <LinearGradient
          colors={['rgba(191,169,254,0.2)', 'rgba(227,193,249,0.2)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.messageBubble}
        >
          {isNew ? (
            <TypewriterText
              text={item.text}
              speed={25}
              style={styles.messageText}
              onComplete={() => handleTypewriterComplete(item.id)}
            />
          ) : (
            <Text style={styles.messageText}>{item.text}</Text>
          )}
        </LinearGradient>

        {/* User avatar on right */}
        {item.isUser && (
          <View style={styles.avatarContainer}>
            <MessageAvatar type="user" size={40} userInitial={initial} />
          </View>
        )}
      </View>
    );
  }, [displayedMessageIds, username, handleTypewriterComplete]);

  const renderLoading = () => {
    if (!isLoading) return null;
    return (
      <View style={[styles.messageRow, styles.messageRowAI]}>
        <View style={styles.avatarContainer}>
          <MessageAvatar type="ai" size={40} />
        </View>
        <LinearGradient
          colors={['rgba(191,169,254,0.2)', 'rgba(227,193,249,0.2)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.loadingBubble}
        >
          <LoadingDots />
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Chat with Mello</Text>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderLoading}
          removeClippedSubviews={false}
        />

        {/* Input Bar */}
        <View style={[styles.inputWrapper, { paddingBottom: 16 }]}>
          <View style={styles.inputPill}>
            <TextInput
              style={styles.input}
              placeholder={isLoading ? 'Please wait...' : 'Type your message'}
              placeholderTextColor={LIGHT_THEME.textMuted}
              value={inputText}
              onChangeText={setInputText}
              editable={!isLoading}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />

            {/* Clear button */}
            {inputText.length > 0 && (
              <Pressable style={styles.clearButton} onPress={() => setInputText('')}>
                <Ionicons name="close" size={18} color={LIGHT_THEME.textSecondary} />
              </Pressable>
            )}

            {/* Send button */}
            <Pressable
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={inputText.trim() ? '#FFFFFF' : LIGHT_THEME.textMuted}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Crisis Resources Modal */}
      {showCrisisResources && (
        <View style={styles.crisisOverlay}>
          <View style={styles.crisisCard}>
            <Text style={styles.crisisTitle}>Mello cares about you</Text>
            <Text style={styles.crisisText}>
              It sounds like you might be going through something difficult.
              Would you like to see some resources that can help?
            </Text>
            <Pressable
              style={styles.crisisButton}
              onPress={() => {
                setShowCrisisResources(false);
                callCrisisLine();
              }}
            >
              <Text style={styles.crisisButtonText}>View Resources</Text>
            </Pressable>
            <Pressable
              style={styles.crisisDismiss}
              onPress={() => setShowCrisisResources(false)}
            >
              <Text style={styles.crisisDismissText}>Continue Chatting</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },

  // Messages
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAI: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    flexShrink: 0,
  },
  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: '#1F2937',
    lineHeight: 22,
  },
  loadingBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },

  // Input
  inputWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,237,250,0.4)',
    borderRadius: 9999,
    paddingLeft: 20,
    paddingRight: 6,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    paddingVertical: 12,
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LIGHT_THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'transparent',
  },

  // Crisis modal (preserved from original)
  crisisOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 20,
  },
  crisisCard: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  crisisTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  crisisText: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  crisisButton: {
    backgroundColor: LIGHT_THEME.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  crisisButtonText: {
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    fontSize: 16,
  },
  crisisDismiss: {
    paddingVertical: 12,
  },
  crisisDismissText: {
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    fontSize: 14,
  },
});
