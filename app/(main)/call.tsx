/**
 * Call route — SelfMind redesign voice pre-session (VOICE tab landing).
 *
 * Renders SelfMindVoicePre. Tapping "Start voice" pushes to
 * /voice-active which mounts the legacy VoiceAgentScreen with the
 * full Hume EVI flow.
 */

import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import SelfMindVoicePre from '@/components/voice/SelfMindVoicePre';

export default function CallTab() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SelfMindVoicePre />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
