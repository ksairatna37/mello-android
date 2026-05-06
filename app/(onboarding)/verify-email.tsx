/**
 * Verify email — 1:1 port of MBVerifyEmail in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding.jsx
 *
 * Cream-2 canvas, back chevron, top mono kicker "STEP 2 OF 6 · CHECK YOUR EMAIL",
 * progress bar (2/6), italic-on-"inbox" headline, 6-box OTP entry, status row
 * (error / verifying), ink primary CTA, resend with 30s cooldown, trust footer.
 *
 * Auth wiring preserved verbatim:
 *   - pendingEmail / verifyOtp / resendOtp from AuthContext
 *   - if no pendingEmail and not yet verified, redirect back to (onboarding)/welcome
 *   - on verify success, AuthContext-driven navigation handles next step
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
  ActivityIndicator,
  Easing as RNEasing,
  Animated as RNAnim,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import { useAuth } from '@/contexts/AuthContext';
import { getOnboardingData } from '@/utils/onboardingStorage';

const RESEND_DELAY = 30;
const OTP_LEN = 6;

/* ─── 6-box OTP input ────────────────────────────────────────────── */

function OtpBoxes({
  value,
  focused,
  hasError,
}: {
  value: string;
  focused: boolean;
  hasError: boolean;
}) {
  // The "active" box is the next empty slot; full string + focused → none active
  const activeIdx = focused ? Math.min(value.length, OTP_LEN - 1) : -1;

  // Blinking caret on the active box
  const caretOp = useSharedValue(1);
  useEffect(() => {
    if (focused) {
      caretOp.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 550, easing: Easing.inOut(Easing.linear) }),
          withTiming(1, { duration: 550, easing: Easing.inOut(Easing.linear) }),
        ),
        -1,
        false,
      );
    } else {
      caretOp.value = withTiming(1, { duration: 120 });
    }
  }, [focused, caretOp]);
  const caretStyle = useAnimatedStyle(() => ({ opacity: caretOp.value }));

  const boxes: React.ReactNode[] = [];
  for (let i = 0; i < OTP_LEN; i++) {
    const v = value[i] ?? '';
    const filled = !!v;
    const isActive = i === activeIdx && value.length < OTP_LEN;

    let borderWidth = 1;
    let borderColor: string = C.line2;
    if (hasError && filled) {
      borderWidth = 1.5;
      borderColor = C.coral;
    } else if (isActive) {
      borderWidth = 2;
      borderColor = C.ink;
    } else if (filled) {
      borderWidth = 1;
      borderColor = C.ink;
    }

    boxes.push(
      <View
        key={i}
        style={[
          styles.box,
          { borderWidth, borderColor },
        ]}
      >
        {filled ? (
          <Text style={styles.boxText}>{v}</Text>
        ) : isActive ? (
          <Animated.View style={[styles.caret, caretStyle]} />
        ) : null}
      </View>,
    );
  }

  return <View style={styles.boxesRow}>{boxes}</View>;
}

/* ─── Spinner (12px, ink or cream, RN Animated rotate) ────────────── */

function Spinner({ color = C.ink, size = 12 }: { color?: string; size?: number }) {
  const rot = useRef(new RNAnim.Value(0)).current;
  useEffect(() => {
    const loop = RNAnim.loop(
      RNAnim.timing(rot, { toValue: 1, duration: 800, easing: RNEasing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [rot]);
  const rotation = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <RNAnim.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        borderTopColor: 'transparent',
        transform: [{ rotate: rotation }],
      }}
    />
  );
}

/* ─── Screen ─────────────────────────────────────────────────────── */

export default function VerifyEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingEmail, verifyOtp, resendOtp, cancelOtp, loading } = useAuth();

  const [otp, setOtp]                   = useState('');
  const [hasError, setHasError]         = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');
  const [isVerifying, setIsVerifying]   = useState(false);
  const [resendTimer, setResendTimer]   = useState(RESEND_DELAY);
  const [verified, setVerified]         = useState(false);
  const [inputFocused, setInputFocused] = useState(true);
  const [resendHint, setResendHint]     = useState<string | null>(null);

  const hiddenRef = useRef<TextInput>(null);

  /* True while exitOtp() is clearing pendingEmail and navigating back
   * to /save-profile. The defensive guard below MUST stand down during
   * this window — otherwise it sees `pendingEmail → null` from cancelOtp
   * and races our `router.replace('/save-profile')` with its own
   * `router.replace('/welcome')`, stealing the user's typed password
   * and email in the process. */
  const cancellingRef = useRef(false);

  /* Bounce back to welcome if no email is pending and not yet verified.
   *
   * `isVerifying` is part of the guard because AuthContext clears
   * `pendingEmail` *during* the await of verifyOtp() — before our
   * own `setVerified(true)` lands. Without this check the guard
   * fires mid-verification and the user briefly sees /welcome before
   * AuthContext's post-auth navigation routes them to /permissions.
   *
   * The cancellingRef check protects the legitimate user-cancel path
   * (Change email / back). The guard only fires for the genuinely
   * off-spec case: user somehow on /verify-email with no auth flow.
   */
  useEffect(() => {
    if (cancellingRef.current) return;
    if (!pendingEmail && !verified && !isVerifying) {
      router.replace('/(onboarding)/welcome' as any);
    }
  }, [pendingEmail, verified, isVerifying, router]);

  /* Focus the hidden input on mount */
  useEffect(() => {
    const t = setTimeout(() => hiddenRef.current?.focus(), 220);
    return () => clearTimeout(t);
  }, []);

  /* Resend countdown */
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);
  const canResend = resendTimer <= 0 && !loading && !isVerifying;

  /* Entrance animations */
  const headerAnim = useSharedValue(0);
  const formAnim   = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    headerAnim.value = withTiming(1, { duration: 520, easing: ease });
    formAnim.value   = withDelay(180, withTiming(1, { duration: 480, easing: ease }));
  }, [headerAnim, formAnim]);
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [{ translateY: (1 - headerAnim.value) * 16 }],
  }));
  const formStyle = useAnimatedStyle(() => ({
    opacity: formAnim.value,
    transform: [{ translateY: (1 - formAnim.value) * 14 }],
  }));

  /* OTP change handler: digits only, max 6 */
  const handleOtpChange = useCallback((raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '').slice(0, OTP_LEN);
    setOtp(cleaned);
    if (hasError) { setHasError(false); setErrorMsg(''); }
    if (resendHint) setResendHint(null);
  }, [hasError, resendHint]);

  /* Verify */
  const runVerify = useCallback(async (code: string) => {
    setIsVerifying(true);
    Keyboard.dismiss();
    try {
      const result = await verifyOtp(code);
      if (result.success) {
        setVerified(true);
        // Route forward based on local progress. RouterGate's default
        // for authed-incomplete is /credibility; we override to
        // /permissions if the user finished pre-auth onboarding before
        // signing up (your-reading → save-profile → OTP). The
        // autopromote case (signin entry, no account, transparent
        // signup) lands on /credibility because they have no local
        // progress — which is the right behavior for them.
        const data = await getOnboardingData();
        const finished = !!(
          data.firstName &&
          Array.isArray(data.personalizeTopics) &&
          data.personalizeTopics.length > 0 &&
          data.qHeadWeather
        );
        router.replace(
          (finished
            ? '/(onboarding)/permissions'
            : '/(onboarding)/credibility') as any,
        );
      } else {
        setHasError(true);
        setErrorMsg(result.error || "That code didn't match — try again.");
      }
    } catch (err: any) {
      setHasError(true);
      setErrorMsg(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [verifyOtp, router]);

  /* Auto-verify when 6 digits entered */
  useEffect(() => {
    if (otp.length === OTP_LEN && !isVerifying && !hasError) {
      runVerify(otp);
    }
  }, [otp, isVerifying, hasError, runVerify]);

  const handleVerifyPress = () => {
    if (otp.length === OTP_LEN && !isVerifying && !loading) runVerify(otp);
  };

  const handleResend = useCallback(async () => {
    if (!canResend) return;
    setResendTimer(RESEND_DELAY);
    setOtp('');
    setHasError(false);
    setErrorMsg('');
    try {
      const result = await resendOtp();
      setResendHint(result.success ? 'Code resent — check your inbox.' : (result.error || 'Failed to resend code.'));
    } catch {
      setResendHint('Failed to resend code.');
    }
  }, [canResend, resendOtp]);

  /* Cancelling the OTP step.
   *
   * Calling cancelOtp() FIRST is critical: it clears pendingEmail in
   * AuthContext, which transitions AuthState off 'pendingOtp'.
   * Without that clear, RouterGate's pendingOtp branch immediately
   * routes the user back to /verify-email — regardless of where we
   * tried to go. A bare router.back() or router.replace() here would
   * loop straight back. Clear the auth state, THEN navigate.
   *
   * Always router.replace, never router.back — same reason as every
   * other onboarding back-handler in this codebase: stack history
   * cannot be trusted (RouterGate.replace doesn't preserve it).
   *
   * Set cancellingRef BEFORE cancelOtp so the defensive useEffect
   * above sees the flag and stands down. Without this, the effect's
   * `pendingEmail → null` trigger races our router.replace and
   * sends the user to /welcome instead of /save-profile, losing
   * their typed password in the process. */
  const exitOtp = useCallback(() => {
    cancellingRef.current = true;
    cancelOtp();
    router.replace('/(onboarding)/save-profile' as any);
  }, [cancelOtp, router]);

  const handleChangeEmail = exitOtp;

  // Hardware back: dismiss kbd, cancel OTP, replace to /save-profile.
  // Block while OTP verify is in flight or while a resend is loading —
  // escaping mid-call can leave pendingEmail in a weird half-cleared state.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (isVerifying || loading) return true;
        Keyboard.dismiss();
        exitOtp();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [isVerifying, loading, exitOtp]),
  );

  const canVerify = otp.length === OTP_LEN && !isVerifying && !loading;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top bar — chevron uses exitOtp (clears pendingEmail then
              router.replace to /save-profile). Never router.back —
              that would loop because RouterGate forces /verify-email
              while pendingEmail is still set. */}
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
              onPress={exitOtp}
              style={styles.backBtn}
              activeOpacity={0.85}
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <Glyphs.Back size={18} color={C.ink} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {/* Header */}
            <Animated.View style={[styles.header, headerStyle]}>
              <Text style={styles.title} numberOfLines={2}>
                Check your <Text style={styles.titleItalic}>inbox</Text>.
              </Text>
              <Text style={styles.body1}>
                We sent a 6-digit code to{' '}
                <Text style={styles.body1Strong}>{pendingEmail || 'your email'}</Text>.{' '}
                <Text style={styles.body1Link} onPress={handleChangeEmail}>Change email</Text>
              </Text>
            </Animated.View>

            {/* OTP block */}
            <Animated.View style={[styles.otpBlock, formStyle]}>
              <Text style={[styles.fieldLabel, hasError && styles.fieldLabelError]}>
                {hasError ? 'CODE' : 'ENTER 6-DIGIT CODE'}
              </Text>

              {/* Boxes are pure visualization — pointerEvents="none" so the
                  whole row's hit area falls through to the TextInput
                  underneath. That's why a single tap reliably focuses
                  and opens the keyboard on Android (no race with an
                  outer Keyboard.dismiss handler, no `.focus()` relay
                  through TouchableWithoutFeedback). */}
              <View style={styles.boxesStack}>
                <TextInput
                  ref={hiddenRef}
                  value={otp}
                  onChangeText={handleOtpChange}
                  keyboardType="number-pad"
                  maxLength={OTP_LEN}
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  style={styles.hitInput}
                  caretHidden
                  selectionColor="transparent"
                  autoCorrect={false}
                  spellCheck={false}
                />
                <View pointerEvents="none">
                  <OtpBoxes value={otp} focused={inputFocused && !isVerifying} hasError={hasError} />
                </View>
              </View>

              {/* Status row */}
              <View style={styles.statusRow}>
                {hasError && (
                  <>
                    <View style={styles.errDot}>
                      <Text style={styles.errBang}>!</Text>
                    </View>
                    <Text style={styles.errText}>{errorMsg}</Text>
                  </>
                )}
                {isVerifying && (
                  <>
                    <Spinner color={C.ink} size={12} />
                    <Text style={styles.checkingText}>Checking your code…</Text>
                  </>
                )}
                {!hasError && !isVerifying && resendHint && (
                  <Text style={styles.hintText}>{resendHint}</Text>
                )}
              </View>

              {/* Verify CTA */}
              <TouchableOpacity
                style={[styles.primary, !canVerify && styles.primaryDim]}
                onPress={handleVerifyPress}
                disabled={!canVerify}
                activeOpacity={0.9}
              >
                {isVerifying ? (
                  <>
                    <Spinner color={C.cream} size={12} />
                    <Text style={styles.primaryText}>Verifying…</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.primaryText}>Verify</Text>
                    <Glyphs.Arrow size={13} color={C.cream} />
                  </>
                )}
              </TouchableOpacity>

              {/* Resend row */}
              <View style={styles.resendRow}>
                <Text style={styles.resendQuestion}>Didn{'’'}t get it?</Text>
                {canResend ? (
                  <TouchableOpacity onPress={handleResend} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.resendLink}>Resend code</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.resendCooldown}>RESEND IN {resendTimer}S</Text>
                )}
              </View>

              {/* Trust footer */}
              <Text style={styles.trust}>
                We{'’'}ll never share this. The code expires in 10 minutes.
              </Text>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream2 },
  flex: { flex: 1 },

  topBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topSide: { width: 36, height: 36 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row', gap: 4,
    paddingHorizontal: 20, paddingTop: 6,
  },
  progressSeg: { flex: 1, height: 3, borderRadius: 2 },
  progressOn:  { backgroundColor: C.ink },
  progressOff: { backgroundColor: 'rgba(26,31,54,0.10)' },

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },

  header: { marginBottom: 28 },
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 32, lineHeight: 40,
    letterSpacing: -0.2,
    color: C.ink,
  },
  titleItalic: { fontFamily: 'Fraunces-MediumItalic' },
  body1: {
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5, lineHeight: 20,
    color: C.ink2,
    marginTop: 10,
    maxWidth: 320,
  },
  body1Strong: { color: C.ink, fontFamily: 'Fraunces-Text-Medium' },
  body1Link: {
    color: C.coral,
    textDecorationLine: 'underline',
  },

  otpBlock: {},
  fieldLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9, letterSpacing: 2.2,
    color: C.ink3,
  },
  fieldLabelError: { color: C.coral },

  boxesRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  box: {
    flex: 1,
    height: 56,
    backgroundColor: C.paper,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  boxText: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 24, lineHeight: 32, color: C.ink,
  },
  caret: {
    width: 1.5, height: 24,
    backgroundColor: C.ink,
  },

  boxesStack: {
    position: 'relative',
  },
  // The actual hit target sits under the boxes and is the size of the
  // box row. opacity 0 reads as "not present" to Android's input
  // manager so the keyboard won't open — 0.01 is the smallest value
  // that keeps it eligible while staying visually invisible.
  hitInput: {
    position: 'absolute',
    top: 10, // matches OtpBoxes marginTop so the hit target lines up
    left: 0, right: 0,
    height: 56,
    opacity: 0.01,
    color: 'transparent',
    fontSize: 24,
    textAlign: 'center',
  },

  statusRow: {
    marginTop: 14, minHeight: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  errDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: C.coral,
    alignItems: 'center', justifyContent: 'center',
  },
  errBang: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 10, color: C.ink,
    lineHeight: 12,
    includeFontPadding: false,
  },
  errText: {
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13, color: C.coral,
    flexShrink: 1,
  },
  checkingText: {
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13, color: C.ink2,
  },
  hintText: {
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13, color: C.ink2,
  },

  primary: {
    marginTop: 18,
    backgroundColor: C.ink,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
  },
  primaryDim: { opacity: 0.5 },
  primaryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15, color: C.cream,
    letterSpacing: 0.2,
  },

  resendRow: {
    marginTop: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  resendQuestion: {
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13, color: C.ink2,
  },
  resendLink: {
    fontFamily: 'Fraunces-Text',
    fontSize: 13, color: C.coral,
    textDecorationLine: 'underline',
  },
  resendCooldown: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10, letterSpacing: 1.6,
    color: C.ink3,
  },

  trust: {
    fontFamily: 'Fraunces-Text',
    fontSize: 11, lineHeight: 17,
    color: C.ink3,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 14,
  },
});
