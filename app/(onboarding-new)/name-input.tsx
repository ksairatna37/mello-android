/**
 * Name Input Screen
 * Step 3 of new onboarding flow - collecting user's name
 *
 * Design: Pixel-perfect clone from Figma
 * Uses OnboardingLayout for consistent navigation
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';

const CURRENT_STEP = 3;

// Floating Label Input Component
const FloatingLabelInput = ({
  label,
  value,
  onChangeText,
  autoFocus = false,
  onSubmitEditing,
  returnKeyType = 'next',
  inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: 'next' | 'done';
  inputRef?: React.RefObject<TextInput>;
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const labelPosition = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    if (value && labelPosition.value === 0) {
      labelPosition.value = 1;
    }
  }, [value]);

  const handleFocus = () => {
    setIsFocused(true);
    labelPosition.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!value) {
      labelPosition.value = withTiming(0, {
        duration: 200,
        easing: Easing.out(Easing.ease),
      });
    }
  };

  const labelStyle = useAnimatedStyle(() => {
    return {
      top: 12 + (1 - labelPosition.value) * 10,
      fontSize: 14 + (1 - labelPosition.value) * 4,
    };
  });

  return (
    <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
      <Animated.Text style={[styles.floatingLabel, labelStyle]}>
        {label}
      </Animated.Text>
      <TextInput
        ref={inputRef}
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        selectionColor="#4DA6E8"
      />
    </View>
  );
};

export default function NameInputScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const lastNameRef = useRef<TextInput>(null);

  const canContinue = firstName.trim().length > 0;

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    if (canContinue) {
      // TODO: Save name to user profile
      router.push({
        pathname: '/(onboarding-new)/profile-picture',
        params: { firstName: firstName.trim(), lastName: lastName.trim() },
      } as any);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <OnboardingLayout
      currentStep={CURRENT_STEP}
      onBack={handleBack}
      onNext={handleContinue}
      canGoBack={true}
      canGoNext={canContinue}
      showHelp={false}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.content}>
            {/* Title */}
            <Text style={styles.title}>What's your name?</Text>

            {/* Input Fields */}
            <View style={styles.inputsWrapper}>
              <FloatingLabelInput
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => lastNameRef.current?.focus()}
              />

              <FloatingLabelInput
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                inputRef={lastNameRef}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />

              {/* Privacy Note */}
              <View style={styles.privacyNote}>
                <Ionicons name="lock-closed" size={14} color="#9E9E9E" />
                <Text style={styles.privacyText} numberOfLines={2}>
                  We'll only use this information to personalize your experience.
                </Text>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    marginBottom: 24,
  },
  inputsWrapper: {
    gap: 16,
  },
  inputContainer: {
    backgroundColor: '#F5F0EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputContainerFocused: {
    borderColor: '#E8E4E0',
  },
  floatingLabel: {
    position: 'absolute',
    left: 16,
    color: '#9E9E9E',
    fontFamily: 'Outfit-Regular',
  },
  textInput: {
    fontSize: 18,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    padding: 0,
    height: 24,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  privacyText: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: '#9E9E9E',
    flex: 1,
  },
});
