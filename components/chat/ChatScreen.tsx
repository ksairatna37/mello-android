/**
 * ChatScreen Component
 * Pixel-perfect clone of the mint/green gradient chat design
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import GradientBackground from '@/components/common/GradientBackground';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatScreenProps {
  username?: string;
  avatarUrl?: string;
  credits?: number;
  onVoicePress?: () => void;
  onUpgradePress?: () => void;
  onSettingsPress?: () => void;
}

// Crisis keywords for detection
const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'want to die', 'end my life',
  'harm myself', 'cutting', 'self-harm', 'overdose',
  'feeling hopeless', 'feeling worthless', 'no reason to live',
  'want to disappear', "can't cope",
];

const detectCrisis = (message: string): boolean => {
  const lowerMessage = message.toLowerCase();
  return CRISIS_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
};

export default function ChatScreen({
  username = 'Friend',
  avatarUrl,
  credits = 245,
  onVoicePress,
  onUpgradePress,
  onSettingsPress,
}: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCrisisResources, setShowCrisisResources] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const welcomeMessage = `What's been on\nyour mind lately?`;

  const handleSend = async () => {
    if (!inputText.trim()) return;

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

    try {
      // TODO: Implement API call
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: getSimulatedResponse(inputText),
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Chat error:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageBubble,
        item.isUser ? styles.userMessage : styles.aiMessage,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          item.isUser ? styles.userMessageText : styles.aiMessageText,
        ]}
      >
        {item.text}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <GradientBackground />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {/* User Avatar */}
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#666" />
            </View>
          )}
        </View>

        {/* Settings Icon */}
        <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress}>
          <Ionicons name="settings-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {messages.length === 0 ? (
        <View style={styles.welcomeContainer}>
          <Text style={styles.greeting}>Hi {username}</Text>
          <Text style={styles.welcomeText}>{welcomeMessage}</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Mello is thinking...</Text>
        </View>
      )}

      {/* Crisis Resources Modal */}
      {showCrisisResources && (
        <View style={styles.crisisOverlay}>
          <View style={styles.crisisCard}>
            <Text style={styles.crisisTitle}>Mello cares about you</Text>
            <Text style={styles.crisisText}>
              It sounds like you might be going through something difficult.
              Would you like to see some resources that can help?
            </Text>
            <TouchableOpacity
              style={styles.crisisButton}
              onPress={() => setShowCrisisResources(false)}
            >
              <Text style={styles.crisisButtonText}>View Resources</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.crisisDismiss}
              onPress={() => setShowCrisisResources(false)}
            >
              <Text style={styles.crisisDismissText}>Continue Chatting</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input Area - Frosted Glass Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inputWrapper}
      >
        <View style={styles.inputCard}>
          {/* Credits & Upgrade Row */}
          <View style={styles.creditsRow}>
            <Text style={styles.creditsText}>
              <Text style={styles.creditsNumber}>{credits}</Text> Credits Remaining
            </Text>
            <TouchableOpacity onPress={onUpgradePress}>
              <Text style={styles.upgradeText}>Upgrade</Text>
            </TouchableOpacity>
          </View>

          {/* Input Field */}
          <TextInput
            style={styles.input}
            placeholder="Describe your project..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          {/* Action Row */}
          <View style={styles.actionRow}>
            <View style={styles.leftActions}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="add" size={24} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="attach" size={24} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={onVoicePress}>
                <Ionicons name="mic-outline" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function getSimulatedResponse(input: string): string {
  const responses = [
    "I hear you, and I'm really glad you shared that with me. Want to tell me more about what's going on?",
    "That sounds like a lot to carry. It's okay to feel this way. How have you been coping?",
    "Thanks for opening up to me! It takes courage to talk about these things. What would feel helpful right now?",
    "I'm here for you. Sometimes just talking about things can help lighten the load. What else is on your mind?",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  greeting: {
    fontSize: 18,
    color: '#333',
    marginBottom: 8,
    fontFamily: 'Outfit-Regular',
  },
  welcomeText: {
    fontSize: 34,
    fontWeight: '700',
    color: '#000',
    lineHeight: 42,
    fontFamily: 'Outfit-Bold',
  },
  messagesContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  userMessage: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
  },
  aiMessage: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    color: '#000',
  },
  loadingContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  loadingText: {
    color: '#333',
    fontStyle: 'italic',
  },
  inputWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  inputCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#7EECD3',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  creditsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  creditsText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Outfit-Regular',
  },
  creditsNumber: {
    fontWeight: '600',
    color: '#000',
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2ECC71',
    fontFamily: 'Outfit-SemiBold',
  },
  input: {
    fontSize: 16,
    color: '#000',
    minHeight: 40,
    maxHeight: 100,
    paddingVertical: 8,
    fontFamily: 'Outfit-Regular',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  leftActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2ECC71',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  // Crisis styles
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
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  crisisTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Outfit-SemiBold',
  },
  crisisText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: 'Outfit-Regular',
  },
  crisisButton: {
    backgroundColor: '#2ECC71',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  crisisButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Outfit-SemiBold',
  },
  crisisDismiss: {
    paddingVertical: 12,
  },
  crisisDismissText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
  },
});
