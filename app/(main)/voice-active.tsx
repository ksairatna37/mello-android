/**
 * Voice Active Session route.
 *
 * Pushed onto by /call (SelfMindVoicePre) when the user taps "Start
 * voice". Mounts the legacy VoiceAgentScreen which connects to Hume
 * EVI and runs the full call.
 *
 * Hidden from the tab bar — only reachable via the pre-session screen.
 */

import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import VoiceAgentScreen from '@/components/voice/VoiceAgentScreen';

export default function VoiceActiveRoute() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <VoiceAgentScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
