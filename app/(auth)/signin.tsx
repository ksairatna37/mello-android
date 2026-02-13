/**
 * Sign In Screen
 * Email/password authentication + Google OAuth
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, Shadows } from '@/constants/spacing';
import { useAuth } from '@/contexts/AuthContext';

// Test credentials for quick login
const TEST_EMAIL = 'test@mello.app';
const TEST_PASSWORD = 'Test1234!';

export default function SignInScreen() {
  console.log('>>> SignInScreen RENDERING');
  const router = useRouter();
  const { signInWithGoogle, loading: authLoading } = useAuth();
  console.log('>>> authLoading:', authLoading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    Alert.alert('Debug', 'Google Sign In button clicked!');
    console.log('>>> handleGoogleSignIn called');
    try {
      setIsGoogleLoading(true);
      setError('');
      console.log('>>> Calling signInWithGoogle...');
      await signInWithGoogle();
      console.log('>>> signInWithGoogle completed');
      // Navigation is handled by AuthContext after successful sign-in
    } catch (err: any) {
      console.error('>>> Google sign in failed:', err);
      setError(err.message || 'Google sign in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
      console.log('>>> handleGoogleSignIn finished');
    }
  };

  // Quick login for development - continues onboarding
  const handleQuickLogin = () => {
    Alert.alert('Debug', 'Quick Login button clicked!');
    setEmail(TEST_EMAIL);
    setPassword(TEST_PASSWORD);
    // Continue to onboarding after auth
    setTimeout(() => {
      router.replace('/(onboarding-new)/disclaimer');
    }, 100);
  };

  const handleSignIn = async () => {
    Alert.alert('Debug', 'Sign In button clicked!');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // TODO: Implement Supabase auth
      console.log('Sign in:', { email, password });

      // Continue to onboarding (for new users) or chat (for returning users)
      // TODO: Check first_login flag from user profile
      router.replace('/(onboarding-new)/disclaimer');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>{'\u2190'} Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Good to see you again! Let's continue where we left off.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor={Colors.light.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor={Colors.light.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.showPasswordButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.showPasswordText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signInButton, isLoading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={isLoading}
          >
            <Text style={styles.signInButtonText}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Quick Login for Development */}
          <TouchableOpacity
            style={styles.quickLoginButton}
            onPress={handleQuickLogin}
          >
            <Text style={styles.quickLoginText}>Quick Login (Dev)</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign In Button */}
          <TouchableOpacity
            style={[styles.googleButton, (isGoogleLoading || authLoading) && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            onPressIn={() => console.log('>>> GOOGLE BUTTON PRESS IN')}
            disabled={isGoogleLoading || authLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#1A1A1A" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#1A1A1A" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.footerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.mello.light,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.screenVertical,
  },
  backButton: {
    paddingVertical: 8,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.mello.purple,
    fontWeight: '500',
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    lineHeight: 24,
  },
  form: {
    gap: 20,
  },
  errorText: {
    color: Colors.light.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  input: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.inputPadding.horizontal,
    paddingVertical: Spacing.inputPadding.vertical,
    fontSize: 16,
    color: Colors.light.text,
    ...Shadows.sm,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 70,
  },
  showPasswordButton: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  showPasswordText: {
    color: Colors.mello.purple,
    fontSize: 14,
    fontWeight: '500',
  },
  forgotPassword: {
    color: Colors.mello.purple,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  signInButton: {
    backgroundColor: Colors.mello.purple,
    paddingVertical: Spacing.buttonPadding.vertical,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    marginTop: 12,
    ...Shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  quickLoginButton: {
    backgroundColor: '#2ECC71',
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    marginTop: 8,
  },
  quickLoginText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    paddingHorizontal: 16,
    color: Colors.light.textMuted,
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.buttonPadding.vertical,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 12,
    ...Shadows.sm,
  },
  googleButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingTop: 40,
  },
  footerText: {
    color: Colors.light.textSecondary,
    fontSize: 16,
  },
  footerLink: {
    color: Colors.mello.purple,
    fontSize: 16,
    fontWeight: '600',
  },
});
