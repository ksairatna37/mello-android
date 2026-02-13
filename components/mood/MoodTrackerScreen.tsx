/**
 * Mood Tracker Screen
 * Pixel-perfect clone with smooth animated transitions
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolateColor,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MoodCharacter, MoodType } from './MoodCharacter';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Mood configuration with colors
const MOODS: {
  id: MoodType;
  label: string;
  topColor: string;
  bottomColor: string;
  buttonBg: string;
  selectedBg: string;
}[] = [
  {
    id: 'anxiety',
    label: 'Anxiety',
    topColor: '#F5D93A',
    bottomColor: '#2D8B57',
    buttonBg: 'rgba(255, 255, 255, 0.25)',
    selectedBg: '#F5D93A',
  },
  {
    id: 'distracted',
    label: 'Distracted',
    topColor: '#E8D4F0',
    bottomColor: '#8B5CF6',
    buttonBg: 'rgba(255, 255, 255, 0.25)',
    selectedBg: '#C4B5FD',
  },
  {
    id: 'joy',
    label: 'Joy',
    topColor: '#F5B5C8',
    bottomColor: '#E85D3B',
    buttonBg: 'rgba(255, 255, 255, 0.25)',
    selectedBg: '#FBBF24',
  },
  {
    id: 'surprised',
    label: 'Surprised',
    topColor: '#FFF3CD',
    bottomColor: '#FFB800',
    buttonBg: 'rgba(255, 255, 255, 0.25)',
    selectedBg: '#FCD34D',
  },
  {
    id: 'sad',
    label: 'Sad',
    topColor: '#BFDBFE',
    bottomColor: '#5B8DEF',
    buttonBg: 'rgba(255, 255, 255, 0.25)',
    selectedBg: '#93C5FD',
  },
  {
    id: 'calm',
    label: 'Calm',
    topColor: '#A7F3D0',
    bottomColor: '#14B8A6',
    buttonBg: 'rgba(255, 255, 255, 0.25)',
    selectedBg: '#5EEAD4',
  },
];

interface MoodButtonProps {
  mood: typeof MOODS[number];
  isSelected: boolean;
  onPress: () => void;
  bottomColor: string;
}

const MoodButton: React.FC<MoodButtonProps> = ({ mood, isSelected, onPress, bottomColor }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: isSelected ? mood.selectedBg : mood.buttonBg,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.moodButton, animatedStyle]}
    >
      <Text style={[styles.moodButtonText, isSelected && styles.moodButtonTextSelected]}>
        {mood.label}
      </Text>
    </AnimatedPressable>
  );
};

export const MoodTrackerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [selectedMoodIndex, setSelectedMoodIndex] = useState(2); // Start with Joy
  const selectedMood = MOODS[selectedMoodIndex];

  // Animation values
  const colorProgress = useSharedValue(selectedMoodIndex);
  const characterOpacity = useSharedValue(1);
  const characterScale = useSharedValue(1);

  // Get current date
  const currentDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
  });

  const changeMood = useCallback((index: number) => {
    if (index === selectedMoodIndex) return;

    // Animate character out
    characterOpacity.value = withTiming(0, { duration: 150 });
    characterScale.value = withTiming(0.8, { duration: 150 });

    // Animate colors
    colorProgress.value = withTiming(index, {
      duration: 400,
      easing: Easing.inOut(Easing.ease),
    });

    // Update state and animate character back in
    setTimeout(() => {
      setSelectedMoodIndex(index);
      characterOpacity.value = withTiming(1, { duration: 200 });
      characterScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    }, 150);
  }, [selectedMoodIndex]);

  // Swipe gesture for changing moods
  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      if (Math.abs(event.velocityX) > 500) {
        const direction = event.velocityX > 0 ? -1 : 1;
        const newIndex = Math.max(0, Math.min(MOODS.length - 1, selectedMoodIndex + direction));
        if (newIndex !== selectedMoodIndex) {
          runOnJS(changeMood)(newIndex);
        }
      }
    });

  // Animated background styles
  const topBackgroundStyle = useAnimatedStyle(() => {
    const colors = MOODS.map(m => m.topColor);
    const index = Math.round(colorProgress.value);
    return {
      backgroundColor: colors[Math.min(index, colors.length - 1)],
    };
  });

  const bottomBackgroundStyle = useAnimatedStyle(() => {
    const colors = MOODS.map(m => m.bottomColor);
    const index = Math.round(colorProgress.value);
    return {
      backgroundColor: colors[Math.min(index, colors.length - 1)],
    };
  });

  const characterAnimatedStyle = useAnimatedStyle(() => ({
    opacity: characterOpacity.value,
    transform: [{ scale: characterScale.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top section with gradient effect */}
      <Animated.View style={[styles.topSection, topBackgroundStyle, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandText}>Mello®</Text>
          <Pressable style={styles.menuButton}>
            <View style={styles.menuIcon}>
              <View style={styles.menuDot} />
              <View style={styles.menuDot} />
              <View style={styles.menuDot} />
              <View style={styles.menuDot} />
            </View>
          </Pressable>
        </View>
      </Animated.View>

      {/* Bottom section with character */}
      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={[styles.bottomSection, bottomBackgroundStyle]}>
          {/* Character */}
          <Animated.View style={[styles.characterWrapper, characterAnimatedStyle]}>
            <MoodCharacter mood={selectedMood.id} size={SCREEN_WIDTH * 0.7} />
          </Animated.View>

          {/* Text content */}
          <View style={styles.textContent}>
            <Text style={styles.mainText}>WHAT'S{'\n'}YOUR MOOD{'\n'}LIKE TODAY</Text>
            <Text style={styles.dateText}>{currentDate}</Text>
          </View>

          {/* Mood buttons */}
          <View style={[styles.moodButtonsContainer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.moodButtonsRow}>
              {MOODS.slice(0, 3).map((mood, index) => (
                <MoodButton
                  key={mood.id}
                  mood={mood}
                  isSelected={selectedMoodIndex === index}
                  onPress={() => changeMood(index)}
                  bottomColor={selectedMood.bottomColor}
                />
              ))}
            </View>
            <View style={styles.moodButtonsRow}>
              {MOODS.slice(3, 6).map((mood, index) => (
                <MoodButton
                  key={mood.id}
                  mood={mood}
                  isSelected={selectedMoodIndex === index + 3}
                  onPress={() => changeMood(index + 3)}
                  bottomColor={selectedMood.bottomColor}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSection: {
    height: SCREEN_HEIGHT * 0.12,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  brandText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 20,
    color: '#1a1a1a',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    width: 20,
    height: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  menuDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    margin: 1,
  },
  bottomSection: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  characterWrapper: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.15,
    alignSelf: 'center',
    zIndex: 2,
  },
  textContent: {
    marginTop: SCREEN_HEIGHT * 0.22,
    paddingHorizontal: 24,
  },
  mainText: {
    fontFamily: 'Outfit-Black',
    fontSize: 42,
    lineHeight: 48,
    color: 'white',
    textTransform: 'uppercase',
  },
  dateText: {
    fontFamily: 'Outfit-Medium',
    fontSize: 18,
    color: 'white',
    marginTop: 12,
    opacity: 0.9,
  },
  moodButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    gap: 12,
  },
  moodButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  moodButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodButtonText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 15,
    color: 'white',
  },
  moodButtonTextSelected: {
    color: '#1a1a1a',
  },
});

export default MoodTrackerScreen;
