/**
 * MessageAvatar Component
 * AI gradient orb or user initial circle for chat messages
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

interface MessageAvatarProps {
  type: 'ai' | 'user';
  size?: number;
  userInitial?: string;
}

function MessageAvatar({ type, size = 40, userInitial = '?' }: MessageAvatarProps) {
  if (type === 'ai') {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="avatarOrb" cx="40%" cy="40%" rx="60%" ry="60%">
            <Stop offset="0%" stopColor="#F8E0FF" stopOpacity="1" />
            <Stop offset="60%" stopColor="#D4C4FF" stopOpacity="0.7" />
            <Stop offset="100%" stopColor="#B8B0FF" stopOpacity="0.4" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="url(#avatarOrb)" />
      </Svg>
    );
  }

  return (
    <View style={[styles.userAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.userInitial, { fontSize: size * 0.4 }]}>
        {userInitial.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export default memo(MessageAvatar);

const styles = StyleSheet.create({
  userAvatar: {
    backgroundColor: '#e8e0ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitial: {
    fontFamily: 'Outfit-SemiBold',
    color: '#6b6b7b',
  },
});
