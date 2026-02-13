/**
 * VoiceScreen Component
 * Pixel-perfect clone of the voice chat with glowing orb
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import GradientBackground from '@/components/common/GradientBackground';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ORB_SIZE = SCREEN_WIDTH * 0.65;

interface VoiceScreenProps {
  onClose?: () => void;
  onMicPress?: () => void;
  isListening?: boolean;
  isSpeaking?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function VoiceScreen({
  onClose,
  onMicPress,
  isListening = false,
  isSpeaking = false,
}: VoiceScreenProps) {
  const insets = useSafeAreaInsets();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    // Glow animation
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    // Rotation animation (subtle)
    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    );

    pulse.start();
    glow.start();
    rotate.start();

    return () => {
      pulse.stop();
      glow.stop();
      rotate.stop();
    };
  }, []);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <GradientBackground />

      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 12 }]}
        onPress={onClose}
      >
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>

      {/* Glowing Orb */}
      <View style={styles.orbContainer}>
        {/* Outer Glow */}
        <Animated.View
          style={[
            styles.orbGlow,
            {
              opacity: glowAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Main Orb */}
        <Animated.View
          style={[
            styles.orb,
            {
              transform: [
                { scale: pulseAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        >
          <Svg width={ORB_SIZE} height={ORB_SIZE} viewBox="0 0 200 200">
            <Defs>
              <RadialGradient
                id="orbGradient"
                cx="50%"
                cy="50%"
                rx="50%"
                ry="50%"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0%" stopColor="#E8F0A0" stopOpacity="0.9" />
                <Stop offset="30%" stopColor="#C5F57A" stopOpacity="0.8" />
                <Stop offset="60%" stopColor="#A8F59E" stopOpacity="0.7" />
                <Stop offset="100%" stopColor="#7EECD3" stopOpacity="0.5" />
              </RadialGradient>
            </Defs>
            <Circle
              cx="100"
              cy="100"
              r="95"
              fill="url(#orbGradient)"
            />
          </Svg>
        </Animated.View>

        {/* Inner Highlight */}
        <View style={styles.orbHighlight} />
      </View>

      {/* Bottom Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 40 }]}>
        {/* Microphone Button */}
        <TouchableOpacity
          style={[
            styles.micButton,
            isListening && styles.micButtonActive,
          ]}
          onPress={onMicPress}
        >
          <Ionicons
            name={isListening ? 'mic' : 'mic-outline'}
            size={28}
            color="#000"
          />
        </TouchableOpacity>

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orbContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbGlow: {
    position: 'absolute',
    width: ORB_SIZE * 1.3,
    height: ORB_SIZE * 1.3,
    borderRadius: ORB_SIZE * 0.65,
    backgroundColor: 'rgba(126, 236, 211, 0.3)',
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    shadowColor: '#7EECD3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 10,
  },
  orbHighlight: {
    position: 'absolute',
    width: ORB_SIZE * 0.5,
    height: ORB_SIZE * 0.3,
    borderRadius: ORB_SIZE * 0.25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    top: '30%',
    left: '20%',
    transform: [{ rotate: '-30deg' }],
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  micButtonActive: {
    backgroundColor: '#2ECC71',
  },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
