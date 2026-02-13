/**
 * Mood Tracker Screen Route
 */

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { MoodTrackerScreen } from '@/components/mood/MoodTrackerScreen';

export default function MoodScreen() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <MoodTrackerScreen />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
