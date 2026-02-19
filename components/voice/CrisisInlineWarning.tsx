/**
 * CrisisInlineWarning Component - Light Theme
 * Inline warning card when crisis keywords detected
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';

interface CrisisInlineWarningProps {
  onConnect: () => void;
  onDismiss: () => void;
}

export default function CrisisInlineWarning({ onConnect, onDismiss }: CrisisInlineWarningProps) {
  return (
    <Animated.View style={styles.container} entering={FadeIn.duration(400)}>
      <View style={styles.iconRow}>
        <Ionicons name="warning-outline" size={20} color="#E53E3E" />
        <Text style={styles.title}>Mello cares about you</Text>
      </View>
      <Text style={styles.message}>
        It sounds like you're in distress. Would you like me to connect you with a crisis helpline?
      </Text>
      <View style={styles.buttonRow}>
        <Pressable style={styles.connectButton} onPress={onConnect}>
          <Text style={styles.connectText}>Yes, connect me</Text>
        </Pressable>
        <Pressable style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissText}>No, keep talking</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FED7D7',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 4,
    gap: 12,
    ...CARD_SHADOW,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: '#E53E3E',
  },
  message: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#742A2A',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  connectButton: {
    flex: 1,
    backgroundColor: '#E53E3E',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  connectText: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  dismissButton: {
    flex: 1,
    backgroundColor: LIGHT_THEME.surface,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  dismissText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
  },
});
