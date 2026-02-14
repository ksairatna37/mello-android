/**
 * Feelings Selection Screen
 * Step 5 of new onboarding flow - what brought you to mello
 *
 * Design: Pixel-perfect clone from Figma
 * - Multi-select options with soft animation
 * - Selected options move to top for better UX
 * - Personalized greeting with user's name
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  LinearTransition,
} from 'react-native-reanimated';

import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { updateOnboardingData } from '@/utils/onboardingStorage';

const CURRENT_STEP = 5;

// Options list
const FEELINGS_OPTIONS = [
  { id: 'anxious', label: 'feeling anxious or worried' },
  { id: 'stressed', label: 'stressed or overwhelmed' },
  { id: 'lonely', label: 'lonely or disconnected' },
  { id: 'burnout', label: 'burnt out from work or life' },
  { id: 'relationship', label: 'relationship issues' },
  { id: 'sleep', label: 'trouble sleeping' },
  { id: 'talk', label: 'just want someone to talk to' },
  { id: 'exploring', label: 'exploring mental wellness' },
  { id: 'other', label: 'feeling something else' },
];

// Animated Option Card Component
const OptionCard = ({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) => {
  const animatedValue = useSharedValue(isSelected ? 1 : 0);

  React.useEffect(() => {
    animatedValue.value = withTiming(isSelected ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.ease),
    });
  }, [isSelected]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: `rgba(245, 240, 235, ${1 + animatedValue.value * 0.06})`,
      borderWidth: 1.5 + animatedValue.value * 0.5,
      borderColor: `rgba(200, 195, 190, ${0.6 + animatedValue.value * 0.4})`,
    };
  });

  const checkboxStyle = useAnimatedStyle(() => {
    return {
      opacity: animatedValue.value,
      transform: [{ scale: 0.8 + animatedValue.value * 0.2 }],
    };
  });

  return (
    <Animated.View
      layout={LinearTransition.duration(350).easing(Easing.bezier(0.25, 0.1, 0.25, 1))}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Animated.View style={[styles.optionCard, containerStyle]}>
          <Text style={styles.optionText}>{label}</Text>
          <Animated.View style={[styles.checkbox, checkboxStyle]}>
            <View style={styles.checkboxFilled}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            </View>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function FeelingsSelectScreen() {
  const router = useRouter();
  const { firstName } = useLocalSearchParams<{ firstName: string }>();
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);

  const userName = firstName || 'there';

  const canContinue = selectedFeelings.length > 0;

  // Sort options: selected ones at top, maintaining original order within each group
  const sortedOptions = useMemo(() => {
    const selected = FEELINGS_OPTIONS.filter((opt) => selectedFeelings.includes(opt.id));
    const unselected = FEELINGS_OPTIONS.filter((opt) => !selectedFeelings.includes(opt.id));
    return [...selected, ...unselected];
  }, [selectedFeelings]);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    if (canContinue) {
      // Save selected feelings to storage
      await updateOnboardingData({ selectedFeelings });
      router.push({
        pathname: '/(onboarding-new)/mood-weight',
        params: { firstName },
      } as any);
    }
  };

  const toggleFeeling = (id: string) => {
    setSelectedFeelings((prev) =>
      prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev, id]
    );
  };

  return (
    <OnboardingLayout
      currentStep={CURRENT_STEP}
      onBack={handleBack}
      onNext={handleContinue}
      canGoBack={true}
      canGoNext={canContinue}
      showHelp={true}
      customHelpText="Select all that feel relevant."
    >
      <View style={styles.content}>
        {/* Greeting */}
        <Text style={styles.greeting}>
          It's really great to meet you, {userName}
        </Text>

        {/* Title with mello in script */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>
            What brought you to{' '}
            <Text style={styles.titleMello}>mello</Text>
            {' '}today ?
          </Text>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>What's been going on for you?</Text>

        {/* Options List - sorted with selected at top */}
        <ScrollView
          style={styles.optionsList}
          contentContainerStyle={styles.optionsContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedOptions.map((option) => (
            <OptionCard
              key={option.id}
              label={option.label}
              isSelected={selectedFeelings.includes(option.id)}
              onPress={() => toggleFeeling(option.id)}
            />
          ))}
        </ScrollView>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: '#888888',
    marginBottom: 8,
  },
  titleContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    lineHeight: 38,
  },
  titleMello: {
    fontFamily: 'Playwrite',
    fontSize: 28,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: '#888888',
    marginBottom: 20,
  },
  optionsList: {
    flex: 1,
  },
  optionsContent: {
    gap: 12,
    paddingBottom: 160, // Extra padding for fade zone + footer
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#F5F0EB',
    borderWidth: 1.5,
    borderColor: 'rgba(200, 195, 190, 0.6)',
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    flex: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFilled: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
