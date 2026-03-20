/**
 * CrisisInlineWarning Component - Light Theme
 * Inline warning card when crisis keywords detected
 *
 * autoExpand: When true, shows expanded view with both call and text options
 *             Used for high-priority interventions (suicidal/crisis)
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';

interface CrisisInlineWarningProps {
  onConnect: () => void;
  onDismiss: () => void;
  autoExpand?: boolean;
}

const handleTextCrisisLine = () => {
  // SMS to 988 (US Crisis Text Line)
  Linking.openURL('sms:988').catch(() => {});
};

export default function CrisisInlineWarning({
  onConnect,
  onDismiss,
  autoExpand = false,
}: CrisisInlineWarningProps) {
  return (
    <Animated.View
      style={[styles.container, autoExpand && styles.containerExpanded]}
      entering={FadeIn.duration(400)}
    >
      <View style={styles.iconRow}>
        <Ionicons name="warning-outline" size={20} color="#E53E3E" />
        <Text style={styles.title}>
          {autoExpand ? 'You matter. Help is available.' : 'Mello cares about you'}
        </Text>
      </View>
      <Text style={styles.message}>
        {autoExpand
          ? "I hear that you're going through something really difficult. Please reach out to someone who can help right now."
          : "It sounds like you're in distress. Would you like me to connect you with a crisis helpline?"}
      </Text>
      {autoExpand ? (
        <View style={styles.expandedButtonRow}>
          <Pressable style={styles.callButton} onPress={onConnect}>
            <Ionicons name="call" size={18} color="#FFFFFF" />
            <Text style={styles.callText}>Call 988</Text>
          </Pressable>
          <Pressable style={styles.textButton} onPress={handleTextCrisisLine}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#E53E3E" />
            <Text style={styles.textButtonText}>Text 988</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <Pressable style={styles.connectButton} onPress={onConnect}>
            <Text style={styles.connectText}>Yes, connect me</Text>
          </Pressable>
          <Pressable style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>No, keep talking</Text>
          </Pressable>
        </View>
      )}
      {autoExpand && (
        <Pressable style={styles.keepTalkingLink} onPress={onDismiss}>
          <Text style={styles.keepTalkingText}>Continue talking with Mello</Text>
        </Pressable>
      )}
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
  containerExpanded: {
    backgroundColor: '#FEB2B2',
    borderWidth: 2,
    borderColor: '#E53E3E',
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
  expandedButtonRow: {
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
  callButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#E53E3E',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callText: {
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  textButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E53E3E',
  },
  textButtonText: {
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
    color: '#E53E3E',
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
  keepTalkingLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  keepTalkingText: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: '#742A2A',
    textDecorationLine: 'underline',
  },
});
