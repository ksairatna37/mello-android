/**
 * SpeechToTextButton Component
 * Wraps expo-speech-recognition for speak-to-write journal feature
 */

import React, { useState, useCallback } from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface SpeechToTextButtonProps {
  onTextRecognized: (text: string) => void;
}

export default function SpeechToTextButton({ onTextRecognized }: SpeechToTextButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const pulseScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const startListening = useCallback(async () => {
    try {
      // Check if expo-speech-recognition is available
      const ExpoSpeechRecognition = require('expo-speech-recognition');

      const { status } = await ExpoSpeechRecognition.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Microphone Permission',
          'Please enable microphone access in your device settings to use speak-to-write.'
        );
        return;
      }

      setIsListening(true);
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );

      ExpoSpeechRecognition.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
      });

      ExpoSpeechRecognition.addListener('result', (event: any) => {
        if (event.results && event.results.length > 0) {
          const result = event.results[event.results.length - 1];
          if (result.isFinal && result[0]?.transcript) {
            onTextRecognized(result[0].transcript + ' ');
          }
        }
      });

      ExpoSpeechRecognition.addListener('end', () => {
        setIsListening(false);
        pulseScale.value = withTiming(1, { duration: 300 });
      });
    } catch {
      // Speech recognition not available - show helpful message
      Alert.alert(
        'Speech Recognition',
        'Speech recognition is not available on this device. Please type your entry instead.'
      );
      setIsListening(false);
      pulseScale.value = withTiming(1, { duration: 300 });
    }
  }, [onTextRecognized]);

  const stopListening = useCallback(() => {
    try {
      const ExpoSpeechRecognition = require('expo-speech-recognition');
      ExpoSpeechRecognition.stop();
    } catch {
      // Ignore
    }
    setIsListening(false);
    pulseScale.value = withTiming(1, { duration: 300 });
  }, []);

  const handlePress = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.button, isListening && styles.buttonActive]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isListening ? 'mic' : 'mic-outline'}
          size={22}
          color={isListening ? '#FC8181' : 'rgba(255,255,255,0.5)'}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: 'rgba(252,129,129,0.15)',
  },
});
