/**
 * Permissions Screen
 * Step 8 (Final) of new onboarding flow - "Last step!"
 *
 * Emotionally-aware UX:
 * - Permissions feel like an invitation, not a demand
 * - Gentle explanations of WHY each permission helps
 * - Toggle switches with haptic feedback
 * - Privacy reassurance throughout
 * - User feels in control of their data
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CURRENT_STEP = 8;

// Smooth ease for animations
const EASE_OUT = Easing.bezier(0.4, 0, 0.2, 1);

// Custom Toggle Switch Component
const ToggleSwitch = ({
  isOn,
  onToggle,
}: {
  isOn: boolean;
  onToggle: () => void;
}) => {
  const translateX = useSharedValue(isOn ? 22 : 2);
  const trackProgress = useSharedValue(isOn ? 1 : 0);

  React.useEffect(() => {
    translateX.value = withTiming(isOn ? 22 : 2, {
      duration: 200,
      easing: EASE_OUT,
    });
    trackProgress.value = withTiming(isOn ? 1 : 0, {
      duration: 200,
      easing: EASE_OUT,
    });
  }, [isOn]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      trackProgress.value,
      [0, 1],
      ['#E8E4E0', '#1A1A1A']
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handlePress = () => {
    // Vibrate on toggle
    if (!isOn) {
      Vibration.vibrate(Platform.OS === 'ios' ? 50 : 70);
    }
    onToggle();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={[styles.toggleTrack, trackStyle]}>
        <Animated.View style={[styles.toggleThumb, thumbStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// Permission Card Component
const PermissionCard = ({
  icon,
  title,
  description,
  boldText,
  isEnabled,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  boldText?: string;
  isEnabled: boolean;
  onToggle: () => void;
}) => {
  return (
    <View style={styles.permissionCard}>
      <View style={styles.permissionContent}>
        <View style={styles.permissionHeader}>
          <Ionicons name={icon} size={22} color="#1A1A1A" />
          <Text style={styles.permissionTitle}>{title}</Text>
        </View>
        <Text style={styles.permissionDescription}>
          {description}
          {boldText && <Text style={styles.boldText}> {boldText}</Text>}
        </Text>
      </View>
      <View style={styles.toggleContainer}>
        <ToggleSwitch isOn={isEnabled} onToggle={onToggle} />
      </View>
    </View>
  );
};

export default function PermissionsScreen() {
  const router = useRouter();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [healthDataEnabled, setHealthDataEnabled] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Navigate to personalizing screen
    router.push('/(onboarding-new)/personalizing' as any);
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://melloai.health/privacy');
  };

  // Request notification permission
  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotificationsEnabled(true);
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  // Request microphone permission
  const handleMicrophoneToggle = async () => {
    if (!microphoneEnabled) {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        setMicrophoneEnabled(true);
      }
    } else {
      setMicrophoneEnabled(false);
    }
  };

  return (
    <OnboardingLayout
      currentStep={CURRENT_STEP}
      onBack={handleBack}
      onNext={handleContinue}
      canGoBack={true}
      canGoNext={true}
      showHelp={false}
      showFadeZone={false}
      showFooter={false}
    >
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>Last step!</Text>

        {/* Subtitle - emotionally aware */}
        <Text style={styles.subtitle}>
          Mello is here to walk beside you on your journey. These permissions help us be there when you need us.
        </Text>

        {/* Permission Cards */}
        <View style={styles.permissionsContainer}>
          {/* Notifications Permission */}
          <PermissionCard
            icon="notifications-outline"
            title="Gentle reminders"
            description="We'll send quiet nudges for daily check-ins and moments of calm."
            boldText="You choose the rhythm."
            isEnabled={notificationsEnabled}
            onToggle={handleNotificationToggle}
          />

          {/* Microphone Permission */}
          <PermissionCard
            icon="mic-outline"
            title="Voice journaling"
            description="Talk to Mello using your voice for a more natural conversation."
            boldText="Speak freely, we listen."
            isEnabled={microphoneEnabled}
            onToggle={handleMicrophoneToggle}
          />

          {/* Health Data Permission */}
          {/* <PermissionCard
            icon="heart-outline"
            title="Wellness insights"
            description="Connect your health data to see how sleep and activity shape your mood."
            boldText="Always private, always yours."
            isEnabled={healthDataEnabled}
            onToggle={() => setHealthDataEnabled(!healthDataEnabled)}
          /> */}
        </View>

        {/* Privacy Reassurance */}
        <View style={styles.privacySection}>
          <Text style={styles.privacyText}>
            We take your privacy (and our own) seriously.
          </Text>
          <TouchableOpacity onPress={openPrivacyPolicy}>
            <Text style={styles.learnMoreLink}>Learn more</Text>
          </TouchableOpacity>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Continue Button - Bottom Right */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingBottom: 24,
  },
  title: {
    fontSize: 36,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: 'Outfit-Regular',
    color: '#666666',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  // Permission Card Styles
  permissionCard: {
    backgroundColor: '#F8F5F2',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  permissionContent: {
    flex: 1,
    paddingRight: 16,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
  permissionDescription: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#666666',
    lineHeight: 20,
  },
  boldText: {
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
  toggleContainer: {
    paddingTop: 4,
  },
  // Toggle Switch Styles
  toggleTrack: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E8E4E0',
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  // Privacy Section
  privacySection: {
    alignItems: 'center',
    gap: 4,
  },
  privacyText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#888888',
    textAlign: 'center',
  },
  learnMoreLink: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
  // Button
  spacer: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  continueButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});
