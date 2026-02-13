/**
 * VoiceActivationScreen Component
 * Based on mockup 11 - Activate Agent screen
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

      {/* Main Card */}
      <View style={styles.mainCard}>
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

      {/* Footer text */}
      <Text style={styles.footerText}>
        Enhanced AI features for voice-based interaction.
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
  activateTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 32,
    fontFamily: 'Outfit-SemiBold',
  },
  orbWrapper: {
    marginBottom: 40,
  },
  orbContainer: {
    width: 160,
    height: 160,
  },
  continueButton: {
    backgroundColor: '#FFD4D8',
    paddingVertical: 16,
    paddingHorizontal: 80,
    borderRadius: 30,
    marginBottom: 24,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: 'Outfit-SemiBold',
  },
  termsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Outfit-Regular',
  },
  linkText: {
    color: '#64B5F6',
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
