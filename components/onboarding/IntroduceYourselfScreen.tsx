/**
 * IntroduceYourselfScreen Component
 * Based on mockup 17 - Stacked cards with name input
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

interface IntroduceYourselfScreenProps {
  onStart?: (name: string) => void;
}

export default function IntroduceYourselfScreen({
  onStart,
}: IntroduceYourselfScreenProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');

  const handleStart = () => {
    if (name.trim() && onStart) {
      onStart(name.trim());
    }
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={[styles.title, { marginTop: insets.top + 20 }]}>
        AI Widget
      </Text>

      {/* Main Card */}
      <View style={styles.mainCard}>
        <Text style={styles.cardTitle}>One more thing</Text>

        {/* Stacked Cards Effect */}
        <View style={styles.stackedCardsContainer}>
          {/* Background cards for stacked effect */}
          <View style={[styles.stackedCard, styles.stackedCard3]} />
          <View style={[styles.stackedCard, styles.stackedCard2]} />

          {/* Main input card with gradient border */}
          <View style={styles.inputCardWrapper}>
            <View style={styles.gradientBorder}>
              <View style={styles.inputCard}>
                <TextInput
                  style={styles.input}
                  placeholder={`${name || 'Tim'}, introduce yourself`}
                  placeholderTextColor="#CCCCCC"
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
              </View>
            </View>
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, !name.trim() && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={!name.trim()}
        >
          <Text style={styles.startButtonText}>Start your journey</Text>
        </TouchableOpacity>
      </View>

      {/* Footer text */}
      <Text style={styles.footerText}>
        AI style selection for conversation tone.
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 32,
    fontFamily: 'Outfit-SemiBold',
  },
  stackedCardsContainer: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  stackedCard: {
    position: 'absolute',
    width: '85%',
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  stackedCard3: {
    transform: [{ translateY: 16 }, { scale: 0.9 }],
    opacity: 0.4,
  },
  stackedCard2: {
    transform: [{ translateY: 8 }, { scale: 0.95 }],
    opacity: 0.7,
  },
  inputCardWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  gradientBorder: {
    padding: 3,
    borderRadius: 23,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#E8D5FF',
    width: '100%',
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    minHeight: 140,
    justifyContent: 'flex-start',
  },
  input: {
    fontSize: 18,
    color: '#1A1A1A',
    fontFamily: 'Outfit-Regular',
  },
  startButton: {
    backgroundColor: '#FFD4D8',
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#F0F0F0',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: 'Outfit-SemiBold',
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
