/**
 * VoiceListeningScreen Component
 * Dark glassmorphic theme - Active listening with orb
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

      {/* Content area */}
      <View style={styles.content}>
        {/* Listening Orb */}
        <View style={styles.orbContainer}>
          <ListeningOrb isActive={isListening} />
        </View>

        {/* Status Text */}
        <Text style={styles.statusText}>{status}</Text>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.plusButton} onPress={onPlusPress}>
            <Ionicons name="add" size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Start chatting..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress}>
            <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 120,
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
    backgroundColor: 'rgba(255, 224, 178, 0.4)',
  },
  orbMain: {
    width: 200,
    height: 200,
  },
  statusText: {
    fontSize: 20,
    fontFamily: 'Outfit-Medium',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    width: '100%',
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: '#FFFFFF',
    paddingVertical: 8,
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
