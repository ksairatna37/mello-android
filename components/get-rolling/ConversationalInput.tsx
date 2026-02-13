/**
 * ConversationalInput Component
 * Chat-style input bar with text input and speak button
 * Compresses to centered circle when listening with slide up animation
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  SlideInDown,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const HORIZONTAL_PADDING = 20;
const CIRCLE_SIZE = 60;
const SLIDE_UP_AMOUNT = 30;

interface ConversationalInputProps {
  placeholder?: string;
  onSubmit: (text: string) => void;
  onStartListening?: () => void;
  onStopListening?: () => void;
  isListening?: boolean;
  accentColor?: string;
}

export default function ConversationalInput({
  placeholder = "Share your age here...",
  onSubmit,
  onStartListening,
  onStopListening,
  isListening = false,
  accentColor = '#2D1525',
}: ConversationalInputProps) {
  const { width: screenWidth } = useWindowDimensions();
  const FULL_WIDTH = screenWidth - (HORIZONTAL_PADDING * 2);

  const [text, setText] = useState('');
  const [showStopIcon, setShowStopIcon] = useState(false);
  const hasText = text.trim().length > 0;

  const config = {
    duration: 450,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  };

  const slowConfig = {
    duration: 600,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  };

  // Animation values
  const progress = useSharedValue(0);           // 0 = expanded, 1 = collapsed
  const slideUp = useSharedValue(0);            // 0 = normal position, 1 = slid up
  const listeningTextOpacity = useSharedValue(0);
  const listeningTextTranslateY = useSharedValue(10);

  useEffect(() => {
    if (isListening) {
      // === ENTERING LISTENING MODE ===
      setShowStopIcon(true);

      // 1. Shrink to circle
      progress.value = withTiming(1, config);

      // 2. Slide up after shrink (start at 450ms)
      slideUp.value = withDelay(450, withTiming(1, slowConfig));

      // 3. Show listening text after slide completes + 1 second
      // 450ms (shrink) + 600ms (slide) + 1000ms (wait) = 2050ms
      listeningTextOpacity.value = withDelay(2050, withTiming(1, { duration: 400 }));
      listeningTextTranslateY.value = withDelay(2050, withTiming(0, { duration: 400 }));

    } else {
      // === EXITING LISTENING MODE ===
      // 1. Hide listening text first
      listeningTextOpacity.value = withTiming(0, { duration: 300 });
      listeningTextTranslateY.value = withTiming(10, { duration: 300 });

      // 2. Slide down after text fades (300ms + small buffer)
      slideUp.value = withDelay(400, withTiming(0, slowConfig));

      // 3. Expand after slide down (400ms + 600ms = 1000ms)
      progress.value = withDelay(1000, withTiming(0, config));

      // 4. Change icon after expansion done
      const timer = setTimeout(() => {
        setShowStopIcon(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isListening]);

  // Container shrink + slide animation combined
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const width = interpolate(progress.value, [0, 1], [FULL_WIDTH, CIRCLE_SIZE]);
    const paddingLeft = interpolate(progress.value, [0, 1], [20, 8]);
    const paddingRight = interpolate(progress.value, [0, 1], [6, 8]);
    // Slide up by moving bottom margin (pushing it up from its resting position)
    const marginBottom = interpolate(slideUp.value, [0, 1], [0, SLIDE_UP_AMOUNT]);

    return {
      width,
      paddingLeft,
      paddingRight,
      marginBottom,
    };
  });

  // Input shrinks in sync
  const inputAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.4], [1, 0]);
    const scaleX = interpolate(progress.value, [0, 1], [1, 0]);

    return {
      opacity,
      transform: [{ scaleX }],
      transformOrigin: 'left',
    };
  });

  // Button animates between circle and full size
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    const width = interpolate(progress.value, [0, 1], [100, 44]);
    const paddingHorizontal = interpolate(progress.value, [0, 1], [16, 0]);

    return {
      width,
      paddingHorizontal,
    };
  });

  // Text inside button fades
  const buttonTextAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.3], [1, 0]);
    return { opacity };
  });

  // Listening text animation
  const listeningTextAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: listeningTextOpacity.value,
      transform: [{ translateY: listeningTextTranslateY.value }],
    };
  });

  const handleSubmit = () => {
    if (hasText) {
      Keyboard.dismiss();
      onSubmit(text.trim());
      setText('');
    }
  };

  const handleSpeakPress = () => {
    if (isListening) {
      onStopListening?.();
    } else {
      Keyboard.dismiss();
      onStartListening?.();
    }
  };

  return (
    <Animated.View
      style={styles.wrapper}
      entering={SlideInDown.duration(400)}
    >
      {/* Input container */}
      <Animated.View style={[styles.inputContainer, containerAnimatedStyle]}>
        {/* Input field */}
        <Animated.View style={[styles.inputWrapper, inputAnimatedStyle]}>
          <TextInput
            style={[styles.input, { color: accentColor }]}
            placeholder={placeholder}
            placeholderTextColor="rgba(0, 0, 0, 0.4)"
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            keyboardType="default"
            autoCorrect={false}
            editable={!isListening}
          />
        </Animated.View>

        {/* Button */}
        {hasText && !isListening && !showStopIcon ? (
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: accentColor }]}
            onPress={handleSubmit}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSpeakPress}
            activeOpacity={0.8}
          >
            <Animated.View style={[styles.speakButton, { backgroundColor: accentColor }, buttonAnimatedStyle]}>
              {showStopIcon ? (
                <Ionicons name="stop" size={22} color="#FFFFFF" />
              ) : (
                <>
                  <Animated.Text style={[styles.speakText, buttonTextAnimatedStyle]}>
                    Speak
                  </Animated.Text>
                  <Animated.View style={buttonTextAnimatedStyle}>
                    <Ionicons name="mic-outline" size={18} color="#FFFFFF" />
                  </Animated.View>
                </>
              )}
            </Animated.View>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Listening text - always rendered, controlled by opacity */}
      <Animated.Text style={[styles.listeningText, listeningTextAnimatedStyle]}>
        Listening...
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 0,
    alignItems: 'center',
  },
  listeningText: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: -10,
    height: 20,
    marginLeft:10
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  inputWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  input: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    paddingVertical: 12,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
  },
  speakText: {
    fontSize: 15,
    fontFamily: 'Outfit-Medium',
    color: '#FFFFFF',
  },
});
