/**
 * Auth Sheet - Email/Password + Google Sign In
 * Floating bottom sheet with white background
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Pressable,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.52;

interface AuthSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string, password: string, isSignUp: boolean) => void;
  onGoogleSignIn: () => void;
}

export default function AuthSheet({
  visible,
  onClose,
  onSubmit,
  onGoogleSignIn,
}: AuthSheetProps) {
  const insets = useSafeAreaInsets();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const scale = useSharedValue(0.96);
  const bottomOffset = useSharedValue(16);

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setIsSignUp(false);
    setIsPasswordFocused(false);
  }, []);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  // Handle keyboard to push sheet up when password is focused
  useEffect(() => {
    const keyboardShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        if (isPasswordFocused) {
          // Push sheet up just enough for password to be visible
          bottomOffset.value = withTiming(180, { duration: 250 });
        }
      }
    );

    const keyboardHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        bottomOffset.value = withTiming(16, { duration: 250 });
      }
    );

    return () => {
      keyboardShow.remove();
      keyboardHide.remove();
    };
  }, [isPasswordFocused]);

  useEffect(() => {
    if (visible) {
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
      // Smooth close animation
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
    bottom: bottomOffset.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleClose = () => {
    Keyboard.dismiss();
    setIsPasswordFocused(false);
    backdropOpacity.value = withTiming(0, { duration: 300 });
    scale.value = withTiming(0.96, { duration: 300 });
    bottomOffset.value = withTiming(16, { duration: 250 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350 }, (finished) => {
      if (finished) {
        runOnJS(hideModal)();
      }
    });
  };

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await onSubmit(email, password, isSignUp);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await onGoogleSignIn();
    } finally {
      setLoading(false);
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
        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Content */}
          <View style={[styles.content, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
            {/* Header */}
            <Animated.View entering={FadeIn.delay(150).duration(250)} style={styles.header}>
              <Text style={styles.title}>
                {isSignUp ? (
                  <>
                    <Text>Create your </Text>
                    <Text style={styles.titleMello}>mello</Text>
                    <Text> space</Text>
                  </>
                ) : (
                  'Welcome back'
                )}
              </Text>
            </Animated.View>

            {/* Form */}
            <Animated.View entering={FadeIn.delay(250).duration(300)} style={styles.form}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor="#BBB"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => {
                      setIsPasswordFocused(false);
                      bottomOffset.value = withTiming(16, { duration: 250 });
                    }}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#BBB"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    onFocus={() => {
                      setIsPasswordFocused(true);
                      bottomOffset.value = withTiming(180, { duration: 250 });
                    }}
                    onBlur={() => setIsPasswordFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#999"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>

            {/* Actions */}
            <Animated.View entering={FadeIn.delay(350).duration(250)} style={styles.actions}>
              {/* Primary Button */}
              <TouchableOpacity
                style={[styles.primaryButton, (loading || !email || !password) && styles.buttonDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.8}
                disabled={loading || !email || !password}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? (isSignUp ? 'Creating...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Button */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                activeOpacity={0.8}
                disabled={loading}
              >
                <GoogleIcon />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Toggle Sign In/Up */}
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setIsSignUp(!isSignUp)}
              >
                <Text style={styles.toggleText}>
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  <Text style={styles.toggleTextBold}>
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Google Icon Component
const GoogleIcon = () => (
  <View style={styles.googleIconContainer}>
    <Ionicons name="logo-google" size={18} color="#4285F4" />
  </View>
);

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
    marginBottom: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  titleMello: {
    fontFamily: 'Playwrite',
    fontSize: 22,
    color: '#1A1A1A',
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  inputContainer: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: '#666',
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  inputIcon: {
    marginLeft: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: '#1A1A1A',
  },
  eyeButton: {
    padding: 12,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 17,
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
    color: '#999',
    paddingHorizontal: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 10,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#666',
  },
  toggleTextBold: {
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
});
