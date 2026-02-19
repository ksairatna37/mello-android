/**
 * VoiceActivationScreen Component
 * Dark glassmorphic theme - Activate Agent screen
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

interface VoiceActivationScreenProps {
  onContinue?: () => void;
  onTermsPress?: () => void;
  onPrivacyPress?: () => void;
}

const AnimatedOrb = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
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

    const opacity = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    opacity.start();

    return () => {
      pulse.stop();
      opacity.stop();
    };
  }, []);

  return (
    <Animated.View
      style={[
        styles.orbContainer,
        {
          transform: [{ scale: pulseAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Svg width={160} height={160} viewBox="0 0 160 160">
        <Defs>
          <RadialGradient id="orbGradient" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#F8E0FF" stopOpacity="1" />
            <Stop offset="30%" stopColor="#E8D0FF" stopOpacity="0.9" />
            <Stop offset="60%" stopColor="#D4C4FF" stopOpacity="0.7" />
            <Stop offset="100%" stopColor="#B8B0FF" stopOpacity="0.4" />
          </RadialGradient>
        </Defs>
        <Circle cx="80" cy="80" r="78" fill="url(#orbGradient)" />
      </Svg>
    </Animated.View>
  );
};

export default function VoiceActivationScreen({
  onContinue,
  onTermsPress,
  onPrivacyPress,
}: VoiceActivationScreenProps) {
  const insets = useSafeAreaInsets();

  const handleTerms = () => {
    if (onTermsPress) {
      onTermsPress();
    } else {
      Linking.openURL('https://melloai.health/terms');
    }
  };

  const handlePrivacy = () => {
    if (onPrivacyPress) {
      onPrivacyPress();
    } else {
      Linking.openURL('https://melloai.health/privacy');
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
        <Text style={styles.activateTitle}>Activate Agent</Text>

        {/* Animated Orb */}
        <View style={styles.orbWrapper}>
          <AnimatedOrb />
        </View>

        {/* Continue Button */}
        <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>

        {/* Terms Text */}
        <Text style={styles.termsText}>
          By tapping 'Continue' and using the app, you're{'\n'}agreeing to our{' '}
          <Text style={styles.linkText} onPress={handleTerms}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text style={styles.linkText} onPress={handlePrivacy}>
            Privacy Policy
          </Text>
        </Text>
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
    paddingTop: 32,
    paddingBottom: 120,
  },
  activateTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    marginBottom: 32,
  },
  orbWrapper: {
    marginBottom: 40,
  },
  orbContainer: {
    width: 160,
    height: 160,
  },
  continueButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 16,
    paddingHorizontal: 80,
    borderRadius: 30,
    marginBottom: 24,
  },
  continueButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
  termsText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 22,
  },
  linkText: {
    color: '#b9a6ff',
  },
});
