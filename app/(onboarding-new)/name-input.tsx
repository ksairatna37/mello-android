import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MelloGradient from '@/components/common/MelloGradient';
import { updateOnboardingData, saveCurrentStep, getOnboardingData } from '@/utils/onboardingStorage';
import { useAuth } from '@/contexts/AuthContext';

export default function NameInputScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, emailUser, authProvider } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const headerAnim = useSharedValue(0);
  const inputAnim  = useSharedValue(0);
  const btnAnim    = useSharedValue(0);

  useEffect(() => {
    saveCurrentStep('name-input');

    // Google/social auth — extract name and skip straight to questions
    if (authProvider === 'google' && user) {
      const meta = user.user_metadata ?? {};
      const given = meta.given_name || (meta.full_name ?? meta.name ?? '').split(' ')[0] || '';
      if (given) {
        updateOnboardingData({ firstName: given }).catch(() => {});
      }
      router.replace('/(onboarding-new)/questions' as any);
      return;
    }

    // Email auth — restore persisted value then animate in
    getOnboardingData().then((data) => {
      if (data.firstName) setFirstName(data.firstName);
    });

    const cfg = { duration: 420, easing: Easing.out(Easing.cubic) };
    headerAnim.value = withDelay(60,  withTiming(1, cfg));
    inputAnim.value  = withDelay(180, withTiming(1, cfg));
    btnAnim.value    = withDelay(300, withTiming(1, cfg));

    // Auto-focus after animation settles
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [{ translateY: (1 - headerAnim.value) * 16 }],
  }));
  const inputStyle = useAnimatedStyle(() => ({
    opacity: inputAnim.value,
    transform: [{ translateY: (1 - inputAnim.value) * 14 }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnAnim.value,
    transform: [{ translateY: (1 - btnAnim.value) * 12 }],
  }));

  const canContinue = firstName.trim().length > 0;

  const handleContinue = async () => {
    if (!canContinue) return;
    await updateOnboardingData({ firstName: firstName.trim() });
    router.replace('/(onboarding-new)/questions' as any);
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(onboarding-new)/personalize-intro' as any);
  };

  // If Google user, render nothing while redirect happens
  if (authProvider === 'google') return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <MelloGradient />

      {/* Scrollable content — shrinks when keyboard appears */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.inner, { paddingTop: insets.top + 8 }]}>

            {/* Header — mirrors QuestionPage counterRow (no progress bar) */}
            <View style={styles.counterRow}>
              <Pressable style={styles.headerBtn} hitSlop={8} onPress={handleBack}>
                <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
              </Pressable>
              <View style={{ flex: 1 }} />
              <View style={styles.headerBtn} />
            </View>

            <Animated.View style={[styles.headerBlock, headerStyle]}>
              <Text style={styles.title}>What should we call you?</Text>
              <Text style={styles.subtitle}>Just your first name is enough.</Text>
            </Animated.View>

            <Animated.View style={[styles.inputWrap, isFocused && styles.inputWrapFocused, inputStyle]}>
              <Ionicons
                name="person-outline"
                size={20}
                color={isFocused ? '#8B7EF8' : '#AAAABC'}
                style={styles.inputIcon}
              />
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Your first name"
                placeholderTextColor="#BBBBCC"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                selectionColor="#8B7EF8"
              />
            </Animated.View>

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Button anchored outside KAV — same bottom distance as personalize-intro */}
      <Animated.View style={[styles.btnContainer, { paddingBottom: insets.bottom + 24 }, btnStyle]}>
        <Pressable
          style={[styles.btn, !canContinue && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0FF',
  },
  flex: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  btnContainer: {
    paddingHorizontal: 24,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: 10,
    marginBottom: 8,
  },
  headerBtn: {
    width: 40,
    marginLeft: -12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    marginTop: 16,
    marginBottom: 32,
    gap: 6,
  },
  title: {
    fontSize: 34,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: '#9999A8',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(139,126,248,0.18)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  inputWrapFocused: {
    borderColor: '#8B7EF8',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  inputIcon: {
    marginTop: 1,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    padding: 0,
  },
  btn: {
    backgroundColor: '#8B7EF8',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  btnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    fontSize: 17,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
});
