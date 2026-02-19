/**
 * Call Tab
 * Voice Agent - phone-call-like interface with Mello
 */

import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import VoiceAgentScreen from '@/components/voice/VoiceAgentScreen';

export default function CallTab() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <VoiceAgentScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
