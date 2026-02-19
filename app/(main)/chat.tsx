/**
 * Chat Tab
 * Direct chat interface matching web's TextChat design
 */

import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import ChatScreen from '@/components/chat/ChatScreen';
import LightGradient from '@/components/common/LightGradient';

export default function ChatTab() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LightGradient variant="warm" />
      <ChatScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
