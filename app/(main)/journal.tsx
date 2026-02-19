/**
 * Journal Tab (hidden - navigated from Home)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import JournalScreen from '@/components/journal/JournalScreen';

export default function JournalTab() {
  return (
    <View style={styles.container}>
      <JournalScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
