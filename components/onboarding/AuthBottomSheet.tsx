/**
 * Auth Bottom Sheet
 * Slides up from welcome screen for Sign In / Sign Up
 * Animation and layout cloned from CrisisBottomSheet.tsx
 *
 * Features:
 * - Animated slide up (spring) / slide down (timing)
 * - Email & password inputs with icons
 * - Sign In button
 * - Google OAuth option
 * - Toggle between Sign In / Sign Up
 * - Keyboard overlays on top (doesn't push sheet)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  Pressable,
  Keyboard,
  Platform,
  ActivityIndicator,
  ToastAndroid,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = 520;

interface AuthBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export default function AuthBottomSheet({ visible, onClose, initialMode = 'signin' }: AuthBottomSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, loading: authLoading } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGoogleSuggestion, setShowGoogleSuggestion] = useState(false);

  // Refs to track password input focus
  const passwordRef = useRef<TextInput>(null);
  const isPasswordInputFocused = useRef(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const scale = useSharedValue(0.96);
  const keyboardOffset = useSharedValue(0);

  // Listen for keyboard show/hide events to move sheet
  useEffect(() => {
    const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const keyboardHideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardShowListener = Keyboard.addListener(keyboardShowEvent, () => {
      // Only lift if password input is focused
      if (isPasswordInputFocused.current) {
        keyboardOffset.value = withTiming(-150, { duration: 300 });
      }
    });

    const keyboardHideListener = Keyboard.addListener(keyboardHideEvent, () => {
      // Slide back down (exit animation)
      keyboardOffset.value = withSpring(0, {
        damping: 20,
        stiffness: 150,
        mass: 0.5,
      });
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setIsSignUp(initialMode === 'signup');
      setIsVisible(true);
      backdropOpacity.value = withTiming(1, { duration: 350 });
      translateY.value = withSpring(0, {
        damping: 50,
        stiffness: 150,
        mass: 0.5,
      });
      scale.value = withSpring(1, {
        damping: 50,
        stiffness: 150,
        mass: 0.8,
      });
    } else if (isVisible) {
      Keyboard.dismiss();
      backdropOpacity.value = withTiming(0, { duration: 300 });
      scale.value = withTiming(0.96, { duration: 300 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350 }, (finished) => {
        if (finished) {
          runOnJS(hideModal)();
        }
      });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value + keyboardOffset.value },
      { scale: scale.value },
    ],
  }));

  const handleClose = () => {
    Keyboard.dismiss();
    backdropOpacity.value = withTiming(0, { duration: 300 });
    scale.value = withTiming(0.96, { duration: 300 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350 }, (finished) => {
      if (finished) {
        runOnJS(hideModal)();
      }
    });
  };

  const handleAuth = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Validate inputs
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter email and password');
      return;
    }
    if (isSignUp && trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    Keyboard.dismiss();
    setError('');
    setShowGoogleSuggestion(false);
    setIsLoading(true);

    try {
      let result: { success: boolean; error?: string; needsOtpVerification?: boolean; existingProvider?: string };

      if (isSignUp) {
        // Sign up with backend (only email and password, no confirmPassword)
        result = await signUpWithEmail(trimmedEmail, trimmedPassword);

        if (result.success && result.needsOtpVerification) {
          // Close sheet - navigation to OTP screen is handled by AuthContext
          handleClose();
          return;
        }
      } else {
        // Sign in with backend
        result = await signInWithEmail(trimmedEmail, trimmedPassword);
      }

      if (result.success) {
        // Success - navigation is handled by AuthContext
        handleClose();
      } else {
        // Check if user should use Google instead
        if (result.existingProvider === 'google') {
          setShowGoogleSuggestion(true);
        }
        // Show error
        setError(result.error || 'Authentication failed. Please try again.');
      }
    } catch (err: any) {
      console.error('>>> Auth error:', err);
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    console.log('>>> handleGoogleAuth called');
    Keyboard.dismiss();
    setError('');
    setIsGoogleLoading(true);

    try {
      console.log('>>> Calling signInWithGoogle...');
      await signInWithGoogle();
      console.log('>>> signInWithGoogle completed');
      // Navigation is handled by AuthContext after successful sign-in
      handleClose();
    } catch (err: any) {
      console.error('>>> Google sign in failed:', err);
      setError(err.message || 'Google sign in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
      console.log('>>> handleGoogleAuth finished');
    }
  };

  const toggleMode = () => {
    if (!isSignUp) {
      // New user — close sheet and start onboarding flow
      handleClose();
      router.replace('/(onboarding-new)/credibility' as any);
    } else {
      setIsSignUp(false);
      setPassword('');
    }
  };

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Floating Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle, { bottom: 16 }]}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Content */}
          <View style={[styles.content, { paddingBottom: insets.bottom > 0 ? insets.bottom : 24 }]}>
            {/* Title */}
            <Text style={styles.title}>
              {isSignUp ? (
                <>
                  Create an Account
                </>
              ) : (
                'Welcome back'
              )}
            </Text>

            {/* Form */}
            <View style={styles.form}>
              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>email</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#9E9E9E" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor="#BDBDBD"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#9E9E9E" style={styles.inputIcon} />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#BDBDBD"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    onFocus={() => {
                      isPasswordInputFocused.current = true;
                      keyboardOffset.value = withTiming(-150, { duration: 300 });
                    }}
                    onBlur={() => {
                      isPasswordInputFocused.current = false;
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? "eye-outline" : "eye-off-outline"}
                      size={20}
                      color="#9E9E9E"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Auth Button */}
              <TouchableOpacity
                style={[
                  styles.authButton,
                  (!email || !password) && styles.authButtonDisabled
                ]}
                onPress={handleAuth}
                disabled={isLoading || !email || !password}
                activeOpacity={0.8}
              >
                <Text style={styles.authButtonText}>
                  {isLoading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  {showGoogleSuggestion && (
                    <TouchableOpacity
                      style={styles.googleSuggestionButton}
                      onPress={handleGoogleAuth}
                      disabled={isGoogleLoading || authLoading}
                      activeOpacity={0.8}
                    >
                      {isGoogleLoading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Ionicons name="logo-google" size={18} color="#FFFFFF" />
                          <Text style={styles.googleSuggestionText}>Sign in with Google</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Button */}
              <TouchableOpacity
                style={[styles.googleButton, (isGoogleLoading || authLoading) && styles.googleButtonDisabled]}
                onPress={handleGoogleAuth}
                disabled={isGoogleLoading || authLoading}
                activeOpacity={0.8}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color="#1A1A1A" size="small" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#4285F4" />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Toggle Sign In / Sign Up */}
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {isSignUp ? "Already have an account? " : "Don't have an account? "}
                </Text>
                <TouchableOpacity onPress={toggleMode}>
                  <Text style={styles.toggleLink}>
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    minHeight: SHEET_HEIGHT,
    zIndex: 999,
    overflow: 'hidden',
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 24,
  },
  melloText: {
    fontFamily: 'DMSerif',
    fontSize: 28,
    color: '#1A1A1A',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: '#1A1A1A',
  },
  eyeButton: {
    padding: 4,
  },
  authButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  authButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  dividerText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#9E9E9E',
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#E53935',
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 12,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#666666',
  },
  toggleLink: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
  errorContainer: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  googleSuggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 8,
  },
  googleSuggestionText: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
});
