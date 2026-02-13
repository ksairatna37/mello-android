/**
 * VoiceListeningScreen Component
 * Based on mockup 19 - Active listening with orb
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

interface VoiceListeningScreenProps {
  status?: string;
  onPlusPress?: () => void;
  onSettingsPress?: () => void;
  onSendMessage?: (message: string) => void;
  isListening?: boolean;
}

const ListeningOrb = ({ isActive = true }: { isActive?: boolean }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!isActive) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.9,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    glow.start();

    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [isActive]);

  return (
    <View style={styles.orbWrapper}>
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.orbGlow,
          {
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      {/* Main orb */}
      <Animated.View
        style={[
          styles.orbMain,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Svg width={200} height={200} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="listeningOrb" cx="40%" cy="40%" rx="60%" ry="60%">
              <Stop offset="0%" stopColor="#FFFDE7" stopOpacity="1" />
              <Stop offset="25%" stopColor="#FFE0B2" stopOpacity="0.95" />
              <Stop offset="50%" stopColor="#FFCCBC" stopOpacity="0.85" />
              <Stop offset="75%" stopColor="#F8BBD9" stopOpacity="0.7" />
              <Stop offset="100%" stopColor="#E1BEE7" stopOpacity="0.4" />
            </RadialGradient>
          </Defs>
          <Circle cx="100" cy="100" r="98" fill="url(#listeningOrb)" />
        </Svg>
      </Animated.View>
    </View>
  );
};

export default function VoiceListeningScreen({
  status = 'Learning Initiated',
  onPlusPress,
  onSettingsPress,
  onSendMessage,
  isListening = true,
}: VoiceListeningScreenProps) {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = React.useState('');

  const handleSend = () => {
    if (inputText.trim() && onSendMessage) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={[styles.title, { marginTop: insets.top + 20 }]}>
        AI Voice Mode
      </Text>

      {/* Main Card */}
      <View style={styles.mainCard}>
        {/* Listening Orb */}
        <View style={styles.orbContainer}>
          <ListeningOrb isActive={isListening} />
        </View>

        {/* Status Text */}
        <Text style={styles.statusText}>{status}</Text>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.plusButton} onPress={onPlusPress}>
            <Ionicons name="add" size={24} color="#666" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Start chatting..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress}>
            <Ionicons name="settings-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer text */}
      <Text style={styles.footerText}>
        Minimal voice UI with a live-listening orb
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: 'Outfit-Bold',
  },
  mainCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    maxHeight: 500,
  },
  orbContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbWrapper: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 224, 178, 0.3)',
  },
  orbMain: {
    width: 200,
    height: 200,
  },
  statusText: {
    fontSize: 20,
    color: '#E0E0E0',
    marginTop: 20,
    marginBottom: 30,
    fontFamily: 'Outfit-Medium',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 25,
    paddingHorizontal: 8,
    paddingVertical: 8,
    width: '100%',
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 8,
    fontFamily: 'Outfit-Regular',
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 'auto',
    marginBottom: 40,
    fontFamily: 'Outfit-Regular',
  },
});
