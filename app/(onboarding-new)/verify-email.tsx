import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
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
import OTPInput from '@/components/onboarding/OTPInput';
import Toast from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';

const RESEND_DELAY = 30;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingEmail, verifyOtp, resendOtp, loading } = useAuth();

  const [otpCode, setOtpCode]                     = useState('');
  const [hasError, setHasError]                   = useState(false);
  const [showToast, setShowToast]                 = useState(false);
  const [toastMessage, setToastMessage]           = useState("That code doesn't look right.");
  const [isVerifying, setIsVerifying]             = useState(false);
  const [resendTimer, setResendTimer]             = useState(RESEND_DELAY);
  const [canResend, setCanResend]                 = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  const headerAnim = useSharedValue(0);
  const inputAnim  = useSharedValue(0);
  const btnAnim    = useSharedValue(0);

  useEffect(() => {
    if (!pendingEmail && !verificationSuccess) {
      router.replace('/(onboarding)/welcome' as any);
      return;
    }
    const cfg = { duration: 420, easing: Easing.out(Easing.cubic) };
    headerAnim.value = withDelay(60,  withTiming(1, cfg));
    inputAnim.value  = withDelay(180, withTiming(1, cfg));
    btnAnim.value    = withDelay(300, withTiming(1, cfg));
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

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

  const handleOTPChange = (code: string) => {
    setOtpCode(code);
    if (hasError) { setHasError(false); setShowToast(false); }
  };

  const handleOTPComplete = useCallback(async (code: string) => {
    setIsVerifying(true);
    try {
      const result = await verifyOtp(code);
      if (result.success) {
        setVerificationSuccess(true);
      } else {
        setHasError(true);
        setToastMessage(result.error || "That code doesn't look right.");
        setShowToast(true);
      }
    } catch (error: any) {
      setHasError(true);
      setToastMessage(error.message || 'Verification failed. Please try again.');
      setShowToast(true);
    } finally {
      setIsVerifying(false);
    }
  }, [verifyOtp]);

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(RESEND_DELAY);
    setOtpCode('');
    setHasError(false);
    try {
      const result = await resendOtp();
      setToastMessage(result.success ? 'Code resent successfully!' : result.error || 'Failed to resend code.');
      setShowToast(true);
    } catch {
      setToastMessage('Failed to resend code.');
      setShowToast(true);
    }
  };

  const handleVerify = () => {
    if (otpCode.length === 6 && !isVerifying && !loading) {
      handleOTPComplete(otpCode);
    }
  };

  const isComplete  = otpCode.length === 6;
  const canVerify   = isComplete && !isVerifying && !loading;
  const maskedEmail = pendingEmail
    ? `${pendingEmail.slice(0, 2)}***@${pendingEmail.split('@')[1] || ''}`
    : 'your@email.com';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <MelloGradient />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={[styles.inner, { paddingTop: insets.top + 8 }]}>

            {/* Back button — mirrors QuestionPage counterRow */}
            <View style={styles.counterRow}>
              <Pressable style={styles.headerBtn} hitSlop={8} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
              </Pressable>
              <View style={{ flex: 1 }} />
              <View style={styles.headerBtn} />
            </View>

            {/* Header */}
            <Animated.View style={[styles.headerBlock, headerStyle]}>
              <Text style={styles.title}>
                We just <Text style={styles.titlePurple}>emailed</Text> you,{'\n'}what's the code?
              </Text>
              <Text style={styles.subtitle}>
                Sent to <Text style={styles.subtitleEmail}>{pendingEmail || 'your@email.com'}</Text>
              </Text>
            </Animated.View>

            {/* OTP + resend */}
            <Animated.View style={[styles.otpBlock, inputStyle]}>
              <OTPInput
                value={otpCode}
                onChange={handleOTPChange}
                onComplete={handleOTPComplete}
                hasError={hasError}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.resendBtn, !canResend && styles.resendBtnDisabled]}
                onPress={handleResend}
                disabled={!canResend || loading}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={15} color={canResend ? '#8B7EF8' : '#BBBBCC'} />
                <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]}>
                  {canResend ? 'Resend code' : `Resend in ${resendTimer}s`}
                </Text>
              </TouchableOpacity>
            </Animated.View>

          </View>
        </KeyboardAvoidingView>

        {/* Verify button — anchored at bottom */}
        <Animated.View style={[styles.btnContainer, { paddingBottom: insets.bottom + 24 }, btnStyle]}>
          <Pressable
            style={[styles.btn, !canVerify && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={!canVerify}
          >
            {isVerifying
              ? <Text style={styles.btnText}>Verifying…</Text>
              : <Text style={styles.btnText}>Verify</Text>
            }
          </Pressable>
        </Animated.View>

        <Toast
          message={toastMessage}
          visible={showToast}
          onHide={() => setShowToast(false)}
          type={toastMessage.includes('success') ? 'success' : 'error'}
        />
      </View>
    </TouchableWithoutFeedback>
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

  // Header row — matches name-input / QuestionPage exactly
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    marginBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
  },

  headerBlock: {
    marginTop: 16,
    marginBottom: 32,
    gap: 8,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    lineHeight: 38,
  },
  titlePurple: {
    color: '#8B7EF8',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#9999A8',
  },
  subtitleEmail: {
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },

  otpBlock: {
    gap: 20,
  },

  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(139,126,248,0.35)',
  },
  resendBtnDisabled: {
    borderColor: 'rgba(187,187,204,0.4)',
  },
  resendText: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: '#8B7EF8',
  },
  resendTextDisabled: {
    color: '#BBBBCC',
  },

  btnContainer: {
    paddingHorizontal: 24,
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
