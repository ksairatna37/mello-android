/**
 * Mood History Tab (hidden - navigated from Home)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import MoodHistoryScreen from '@/components/mood/MoodHistoryScreen';

export default function MoodHistoryTab() {
  return (
    <View style={styles.container}>
      <MoodHistoryScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
