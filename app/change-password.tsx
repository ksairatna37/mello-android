/**
 * Change Password Screen
 * Allows logged-in users to change their password via OTP verification
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import MelloGradient from '@/components/common/MelloGradient';
import OTPInput from '@/components/onboarding/OTPInput';
import Toast from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { resetPassword, confirmReset } from '@/services/auth';

type Step = 'request' | 'verify';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, emailUser } = useAuth();

  const currentEmail = user?.email || emailUser?.email || '';

  const [step, setStep] = useState<Step>('request');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');

  const showMessage = (message: string, type: 'error' | 'success' = 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };

  const handleBack = () => {
    if (step === 'verify') {
      setStep('request');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setHasError(false);
    } else {
      router.back();
    }
  };

  const handleSendCode = async () => {
    if (!currentEmail) {
      showMessage('No email found');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(currentEmail);
      if (result.success) {
        setStep('verify');
        showMessage('Code sent to your email', 'success');
      } else {
        showMessage(result.error || 'Failed to send code');
      }
    } catch (error: any) {
      showMessage(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (code: string) => {
    setOtpCode(code);
    if (hasError) {
      setHasError(false);
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (otpCode.length !== 6) {
      showMessage('Please enter the 6-digit code');
      setHasError(true);
      return;
    }

    if (newPassword.length < 6) {
      showMessage('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await confirmReset(currentEmail, otpCode, newPassword);
      if (result.success) {
        showMessage('Password changed successfully!', 'success');
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        showMessage(result.error || 'Failed to change password');
        if (result.error?.toLowerCase().includes('otp') || result.error?.toLowerCase().includes('code')) {
          setHasError(true);
        }
      }
    } catch (error: any) {
      showMessage(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = otpCode.length === 6 && newPassword.length >= 6 && newPassword === confirmPassword;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <MelloGradient />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {step === 'request' ? (
            /* Step 1: Request Code */
            <>
              <Text style={styles.title}>
                Change your{'\n'}<Text style={styles.titleBold}>Password</Text>
              </Text>

              <Text style={styles.description}>
                We'll send a verification code to your email to confirm it's you.
              </Text>

              <View style={styles.emailCard}>
                <Ionicons name="mail-outline" size={20} color="#666" />
                <Text style={styles.emailText}>{currentEmail}</Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleSendCode}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Step 2: Verify & Set Password */
            <>
              <Text style={styles.title}>
                Enter the <Text style={styles.titleBold}>Code</Text>
              </Text>

              <Text style={styles.description}>
                We've sent a code to <Text style={styles.emailHighlight}>{currentEmail}</Text>
              </Text>

              {/* OTP Input */}
              <View style={styles.otpContainer}>
                <OTPInput
                  value={otpCode}
                  onChange={handleOTPChange}
                  onComplete={() => {}}
                  hasError={hasError}
                  autoFocus={true}
                />
              </View>

              {/* New Password */}
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  placeholderTextColor="#AAA"
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  placeholderTextColor="#AAA"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, (!canSubmit || loading) && styles.buttonDisabled]}
                onPress={handleChangePassword}
                activeOpacity={0.8}
                disabled={!canSubmit || loading}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Changing...' : 'Change Password'}
                </Text>
              </TouchableOpacity>

              {/* Resend Code */}
              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleSendCode}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={16} color="#666" />
                <Text style={styles.resendText}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Toast */}
      <View style={styles.toastContainer}>
        <Toast
          message={toastMessage}
          visible={showToast}
          onHide={() => setShowToast(false)}
          type={toastType}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Outfit-Regular',
    color: '#1A1A1A',
    lineHeight: 40,
    marginBottom: 16,
  },
  titleBold: {
    fontFamily: 'Outfit-Bold',
  },
  description: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: '#666',
    lineHeight: 22,
    marginBottom: 24,
  },
  emailHighlight: {
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },
  emailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 12,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  emailText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },
  primaryButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  otpContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: '#1A1A1A',
    paddingVertical: 16,
  },
  eyeButton: {
    padding: 8,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 12,
  },
  resendText: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: '#666',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
