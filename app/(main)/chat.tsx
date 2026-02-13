/**
 * Chat Tab
 * Main conversation interface with new UI from mockups
 */

import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import ChatHomeScreen from '@/components/chat/ChatHomeScreen';
import ChatSuggestionsScreen from '@/components/chat/ChatSuggestionsScreen';
import { VoiceActivationScreen, VoiceListeningScreen } from '@/components/voice';

type ScreenMode = 'home' | 'suggestions' | 'voice-activate' | 'voice-listening';

export default function ChatTab() {
  const [mode, setMode] = useState<ScreenMode>('home');
  const [username] = useState('James');

  const handleTopicPress = (topic: any) => {
    console.log('Topic pressed:', topic);
    setMode('suggestions');
  };

  const handleSuggestionPress = (suggestion: any) => {
    console.log('Suggestion pressed:', suggestion);
    // TODO: Send suggestion as message
  };

  const handleVoiceActivate = () => {
    setMode('voice-activate');
  };

  const handleVoiceContinue = () => {
    setMode('voice-listening');
  };

  const handleSendMessage = (message: string) => {
    console.log('Message sent:', message);
    // TODO: Send to API
  };

  const handleBack = () => {
    if (mode === 'voice-listening') {
      setMode('voice-activate');
    } else if (mode === 'voice-activate') {
      setMode('home');
    } else if (mode === 'suggestions') {
      setMode('home');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {mode === 'home' && (
        <ChatHomeScreen
          username={username}
          onTopicPress={handleTopicPress}
          onMicPress={handleVoiceActivate}
          onSendMessage={handleSendMessage}
        />
      )}

      {mode === 'suggestions' && (
        <ChatSuggestionsScreen
          username={username}
          onSuggestionPress={handleSuggestionPress}
          onMicPress={handleVoiceActivate}
          onSendMessage={handleSendMessage}
          onMenuPress={handleBack}
        />
      )}

      {mode === 'voice-activate' && (
        <VoiceActivationScreen
          onContinue={handleVoiceContinue}
        />
      )}

      {mode === 'voice-listening' && (
        <VoiceListeningScreen
          status="Listening..."
          isListening={true}
          onPlusPress={handleBack}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
});
