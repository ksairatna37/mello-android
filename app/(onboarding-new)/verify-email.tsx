/**
 * Email Verification Screen (OTP)
 * Step 1 of new onboarding flow
 *
 * Features:
 * - 6-digit OTP input with auto-focus
 * - Resend code button (disabled initially, enabled after delay or completion)
 * - Error state with toast notification
 * - Progress indicator
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OTPInput from '@/components/onboarding/OTPInput';
import Toast from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';

const RESEND_DELAY = 30; // Seconds before resend is enabled

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { pendingEmail, verifyOtp, resendOtp, loading } = useAuth();

  const [otpCode, setOtpCode] = useState('');
  const [hasError, setHasError] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("That code doesn't look right.");
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_DELAY);
  const [canResend, setCanResend] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Redirect if no pending email (but not after successful verification)
  useEffect(() => {
    if (!pendingEmail && !verificationSuccess) {
      console.log('>>> No pending email, redirecting to welcome');
      router.replace('/(onboarding)/welcome' as any);
    }
  }, [pendingEmail, verificationSuccess, router]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleOTPChange = (code: string) => {
    setOtpCode(code);
    // Clear error when user starts typing again
    if (hasError) {
      setHasError(false);
      setShowToast(false);
    }
  };

  const handleOTPComplete = useCallback(async (code: string) => {
    setIsVerifying(true);

    try {
      const result = await verifyOtp(code);

      if (result.success) {
        // Mark as success to prevent redirect on pendingEmail clear
        setVerificationSuccess(true);
        // Success - navigation is handled by AuthContext
        console.log('>>> OTP verified successfully');
      } else {
        // Error
        setHasError(true);
        setToastMessage(result.error || "That code doesn't look right.");
        setShowToast(true);
      }
    } catch (error: any) {
      console.error('>>> OTP verification error:', error);
      setHasError(true);
      setToastMessage(error.message || "Verification failed. Please try again.");
      setShowToast(true);
    } finally {
      setIsVerifying(false);
    }
  }, [verifyOtp]);

  const handleResendCode = async () => {
    if (!canResend) return;

    // Reset state
    setCanResend(false);
    setResendTimer(RESEND_DELAY);
    setOtpCode('');
    setHasError(false);

    try {
      const result = await resendOtp();
      if (result.success) {
        setToastMessage('Code resent successfully!');
        setShowToast(true);
      } else {
        setToastMessage(result.error || 'Failed to resend code.');
        setShowToast(true);
      }
    } catch (error: any) {
      console.error('>>> Resend OTP error:', error);
      setToastMessage('Failed to resend code.');
      setShowToast(true);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleNext = () => {
    if (otpCode.length === 6) {
      handleOTPComplete(otpCode);
    }
  };

  const isComplete = otpCode.length === 6;

  // Mask email for display (show first 2 chars + *** + domain)
  const maskedEmail = pendingEmail
    ? `${pendingEmail.slice(0, 2)}***@${pendingEmail.split('@')[1] || ''}`
    : 'your@email.com';

  return (
    <OnboardingLayout
      currentStep={1}
      onBack={handleBack}
      onNext={handleNext}
      canGoBack={true}
      canGoNext={isComplete && !isVerifying && !loading}
    >
      {/* Title */}
      <View>
        <Text style={styles.title}>
          We just <Text style={styles.titleBold}>Emailed</Text> you,{'\n'}what's the code?
        </Text>
      </View>

      {/* OTP Input */}
      <View style={styles.otpContainer}>
        <OTPInput
          value={otpCode}
          onChange={handleOTPChange}
          onComplete={handleOTPComplete}
          hasError={hasError}
          autoFocus={true}
        />
      </View>

      {/* Description */}
      <View>
        <Text style={styles.description}>
          We've sent an <Text style={styles.descriptionBold}>Email</Text> verification code to{' '}
          <Text style={styles.emailText}>{pendingEmail || 'your@email.com'}</Text>
        </Text>
      </View>

      {/* Resend Code Button */}
      <View>
        <TouchableOpacity
          style={[styles.resendButton, !canResend && styles.resendButtonDisabled]}
          onPress={handleResendCode}
          disabled={!canResend || loading}
          activeOpacity={0.7}
        >
          <Ionicons
            name="refresh"
            size={18}
            color={canResend ? '#1A1A1A' : '#AAA'}
          />
          <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]}>
            {canResend ? 'Resend code' : `Resend code (${resendTimer}s)`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Toast for Error/Success */}
      <View style={styles.toastContainer}>
        <Toast
          message={toastMessage}
          visible={showToast}
          onHide={() => setShowToast(false)}
          type={toastMessage.includes('success') ? 'success' : 'error'}
        />
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 32,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    lineHeight: 40,
    marginBottom: 24,
  },
  titleBold: {
    fontFamily: 'Outfit-Bold',
  },
  otpContainer: {
    marginBottom: 20,
  },
  description: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  descriptionBold: {
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
  emailText: {
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E8E4E0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 8,
  },
  resendButtonDisabled: {
    backgroundColor: '#F5F3F0',
  },
  resendText: {
    fontSize: 15,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },
  resendTextDisabled: {
    color: '#AAA',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
