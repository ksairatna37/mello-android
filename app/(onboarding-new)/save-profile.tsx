import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MelloGradient from '@/components/common/MelloGradient';
import { useAuth } from '@/contexts/AuthContext';

export default function SaveProfileScreen() {
  const insets = useSafeAreaInsets();
  const { signUpWithEmail, signInWithEmail, signInWithGoogle, loading: authLoading } = useAuth();

  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordRef = useRef<TextInput>(null);

  // Entrance animations
  const topAnim = useSharedValue(0);
  const formAnim = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    topAnim.value = withTiming(1, { duration: 550, easing: ease });
    formAnim.value = withDelay(200, withTiming(1, { duration: 500, easing: ease }));
  }, []);

  const topStyle = useAnimatedStyle(() => ({
    opacity: topAnim.value,
    transform: [{ translateY: (1 - topAnim.value) * 20 }],
  }));
  const formStyle = useAnimatedStyle(() => ({
    opacity: formAnim.value,
    transform: [{ translateY: (1 - formAnim.value) * 16 }],
  }));

  const handleAuth = useCallback(async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter your email and password');
      return;
    }
    if (isSignUp && trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    Keyboard.dismiss();
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        const result = await signUpWithEmail(trimmedEmail, trimmedPassword);
        if (!result.success) {
          if (result.existingProvider === 'google') {
            setError('This email is linked to Google. Use "Continue with Google" below.');
          } else {
            setError(result.error || 'Sign up failed. Please try again.');
          }
        }
        // On success: AuthContext navigates to verify-email, then to welcome-aboard (local data detected)
      } else {
        const result = await signInWithEmail(trimmedEmail, trimmedPassword);
        if (!result.success) {
          if (result.existingProvider === 'google') {
            setError('This email is linked to Google. Use "Continue with Google" below.');
          } else {
            setError(result.error || 'Sign in failed. Please try again.');
          }
        }
        // On success: AuthContext navigates to welcome-aboard (local data) or main app
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, isSignUp, signUpWithEmail]);

  const handleGoogle = useCallback(async () => {
    Keyboard.dismiss();
    setError('');
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      // AuthContext handles navigation after Google sign-in
    } catch (err: any) {
      setError(err.message || 'Google sign in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  }, [signInWithGoogle]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <MelloGradient />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top section */}
        <Animated.View style={[styles.top, topStyle]}>
         
          <Text style={styles.heading}>
            {isSignUp ? 'Your profile is ready.' : 'Welcome back.'}
          </Text>
          <Text style={styles.subheading}>
            {isSignUp
              ? 'Create a free account to save your emotional profile and start talking to Mello.'
              : 'Sign in to your account to save your profile and pick up where you left off.'}
          </Text>
        </Animated.View>

        {/* Auth form */}
        <Animated.View style={[styles.form, formStyle]}>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>email</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color="#9999A8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#BDBDBD"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color="#9999A8" style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="at least 6 characters"
                placeholderTextColor="#BDBDBD"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleAuth}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color="#9999A8"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Primary CTA */}
          <TouchableOpacity
            style={[styles.primaryBtn, (!email || !password) && styles.primaryBtnDisabled]}
            onPress={handleAuth}
            disabled={isLoading || !email || !password}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={[styles.googleBtn, (isGoogleLoading || authLoading) && styles.googleBtnDisabled]}
            onPress={handleGoogle}
            disabled={isGoogleLoading || authLoading}
            activeOpacity={0.85}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#1A1A1A" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign in link */}
          <View style={styles.signinRow}>
            <Text style={styles.signinText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            </Text>
            <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError(''); }}>
              <Text style={styles.signinLink}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F0FF',
  },
  scroll: {
    paddingHorizontal: 28,
    flexGrow: 1,
  },
  top: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(139,126,248,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 36,
  },
  heading: {
    fontFamily: 'DMSerif',
    fontSize: 32,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 10,
  },
  subheading: {
    fontFamily: 'Outfit-Regular',
    fontSize: 15,
    color: '#7A7A95',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontFamily: 'Outfit-Medium',
    fontSize: 12,
    color: '#9999A8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(139,126,248,0.18)',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: 'Outfit-Regular',
    fontSize: 15,
    color: '#1A1A1A',
  },
  eyeBtn: {
    padding: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(255,80,80,0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorText: {
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    color: '#D93025',
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#8B7EF8',
    borderRadius: 999,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 17,
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(139,126,248,0.15)',
  },
  dividerText: {
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    color: '#BBBBCC',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 54,
    borderWidth: 1.5,
    borderColor: 'rgba(139,126,248,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  googleBtnDisabled: {
    opacity: 0.5,
  },
  googleBtnText: {
    fontFamily: 'Outfit-Medium',
    fontSize: 16,
    color: '#1A1A1A',
  },
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  signinText: {
    fontFamily: 'Outfit-Regular',
    fontSize: 14,
    color: '#9999A8',
  },
  signinLink: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 14,
    color: '#8B7EF8',
  },
});
