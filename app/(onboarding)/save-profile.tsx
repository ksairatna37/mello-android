/**
 * Save profile — 1:1 port of MBAuth in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding.jsx
 *
 * Cream-2 canvas, back chevron, kicker, italic-on-"small" headline, Google
 * button (paper), divider, email + password fields, password-strength meter,
 * "SHOW" toggle, primary "Create account" CTA, terms footer.
 *
 * Auth wiring preserved verbatim:
 *   - signUpWithEmail / signInWithEmail / signInWithGoogle from AuthContext
 *   - error and existingProvider handling identical to previous version
 *   - on signup success, AuthContext routes to /verify-email
 *   - on signin success, AuthContext routes to welcome-aboard or main app
 *
 * Apple sign-in is omitted — not wired in AuthContext yet.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import { useAuth } from '@/contexts/AuthContext';
import { getOnboardingData } from '@/utils/onboardingStorage';

/**
 * "Did the user finish pre-auth onboarding before reaching this screen?"
 *
 * True iff the chain has been walked top-to-bottom — firstName from
 * /name-input, personalizeTopics from /personalize-intro, qHeadWeather
 * from Q1. We don't need to check every field; these three are the
 * canonical signal. Used to decide post-auth destination:
 *   - true  → /permissions  (continue forward; they earned it)
 *   - false → /credibility  (start fresh; they came in cold)
 *
 * Inlined rather than imported because the codebase explicitly does
 * NOT want a "derive a step from local data" utility — that pattern
 * (deriveOnboardingStep) was deleted because it landed users on the
 * wrong step from stale storage. This is a single binary question.
 */
async function hasFinishedPreAuthChain(): Promise<boolean> {
  const data = await getOnboardingData();
  const result = !!(
    data.firstName &&
    Array.isArray(data.personalizeTopics) &&
    data.personalizeTopics.length > 0 &&
    data.qHeadWeather
  );
  console.log(
    '[save-profile] hasFinishedPreAuthChain →',
    result,
    {
      firstName: data.firstName ?? null,
      personalizeTopicsCount: Array.isArray(data.personalizeTopics)
        ? data.personalizeTopics.length
        : 0,
      qHeadWeather: data.qHeadWeather ?? null,
    },
  );
  return result;
}

/* ─── Google logo (4-color SVG, matches design) ──────────────────── */

function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6c-.3 1.3-1 2.4-2.2 3.1v2.6h3.5c2-1.9 3.1-4.6 3.1-7.5z" />
      <Path fill="#34A853" d="M12 22c2.9 0 5.3-1 7.1-2.6l-3.5-2.6c-1 .6-2.2 1-3.6 1-2.8 0-5.1-1.9-5.9-4.4H2.4v2.7C4.2 19.7 7.8 22 12 22z" />
      <Path fill="#FBBC05" d="M6.1 13.4c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V6.7H2.4C1.5 8.3 1 10.1 1 12s.5 3.7 1.4 5.3l3.7-2.9z" />
      <Path fill="#EA4335" d="M12 5.6c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.3 2.3 14.9 1.3 12 1.3 7.8 1.3 4.2 3.7 2.4 7.1l3.7 2.9C6.9 7.5 9.2 5.6 12 5.6z" />
    </Svg>
  );
}

/* ─── Mode-toggle easing (hoisted so they're not recreated on render) ─
 *
 * Pure sine S-curve (`Easing.inOut(Easing.sin)`) for BOTH halves of
 * the crossfade. Two reasons we share the same curve:
 *
 *   1. Continuity at the swap. Both halves approach the modeAnim=0
 *      boundary with the SAME (low) velocity — fade-out's last few
 *      ms and fade-in's first few ms are equally gentle. The swap
 *      becomes invisible instead of a "stop, start" beat.
 *
 *   2. Continuity in feel. One easing across both halves reads as a
 *      single motion. Mixing accelerate (out) with decelerate (in)
 *      feels like two separate animations stitched together; the
 *      "snap" the user felt was the accelerate curve speeding up
 *      into 0.
 *
 * Sine's the smoothest of the inOut family — softer than cubic,
 * which is what the user asked for.
 */
const FADE_OUT_EASING = Easing.inOut(Easing.sin);
const FADE_IN_EASING  = Easing.inOut(Easing.sin);

/* ─── Password strength helpers ──────────────────────────────────── */

function strengthBuckets(pw: string): { filled: number; label: string } {
  const len = pw.length;
  if (len === 0) return { filled: 0, label: 'AT LEAST 6 CHARACTERS' };
  if (len < 6)   return { filled: 1, label: 'TOO SHORT' };
  if (len < 8)   return { filled: 2, label: 'OK · A LITTLE LONGER FOR SOLID' };
  if (len < 11)  return { filled: 3, label: 'SOLID · ONE MORE CHARACTER FOR GREAT' };
  return            { filled: 4, label: 'SAFE' };
}

/* ─── Screen ─────────────────────────────────────────────────────── */

export default function SaveProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUpWithEmail, signInWithEmail, signInWithGoogle, loading: authLoading } = useAuth();

  // Two entry points reach this screen:
  //   (a) End of pre-auth onboarding (your-reading → save-profile)
  //       — defaults to signup mode. User already filled questions /
  //       personalize / name; "Save your small progress." is honest
  //       because they actually have progress to save.
  //   (b) "I already have an account" on welcome
  //       — opens with ?mode=signin. User has done NO onboarding yet.
  //       If they toggle from signin to signup here, the original
  //       "save progress" copy is misleading (there's no progress).
  //       We swap in a fresh-start signup heading instead.
  // The mode param drives the initial isSignUp state, the heading
  // copy, and where the back button takes the user.
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialIsSignUp = params.mode !== 'signin';
  const fromWelcome = params.mode === 'signin';

  const [isSignUp, setIsSignUp]           = useState(initialIsSignUp);
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [pwFocused, setPwFocused]         = useState(false);
  const [emailFocused, setEmailFocused]   = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError]                 = useState('');

  const passwordRef = useRef<TextInput>(null);

  /* Entrance animations */
  const topAnim  = useSharedValue(0);
  const formAnim = useSharedValue(0);
  /* Mode crossfade — drives a quick fade-out → swap → fade-in when the
     user taps "Sign in" / "Sign up" toggle. Multiplied into the existing
     topStyle/formStyle opacity so entrance and crossfade compose without
     overriding each other. Stays at 1 except briefly during a toggle. */
  const modeAnim = useSharedValue(1);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    topAnim.value  = withTiming(1, { duration: 550, easing: ease });
    formAnim.value = withDelay(180, withTiming(1, { duration: 500, easing: ease }));
  }, [topAnim, formAnim]);
  const topStyle  = useAnimatedStyle(() => ({
    opacity: topAnim.value * modeAnim.value,
    transform: [{ translateY: (1 - topAnim.value) * 18 }],
  }));
  const formStyle = useAnimatedStyle(() => ({
    // modeAnim multiplied in so the entire form (inputs, CTA, divider,
    // Google, terms — every child of the form wrapper) crossfades
    // together with the heading on toggle. Single unified opacity
    // means no element flips visually before its neighbors.
    opacity: formAnim.value * modeAnim.value,
    transform: [{ translateY: (1 - formAnim.value) * 14 }],
  }));

  /* Toggle "Sign in" ↔ "Sign up" with a continuous crossfade.
   *
   * Both halves use the same sine S-curve and similar durations so
   * the transition reads as one motion rather than out + in. The
   * fade-in is a touch longer so the new content has space to
   * settle without feeling rushed.
   *
   *   Phase 1 (out):  420ms inOut sin → gentle approach to invisible
   *   Phase 2 (swap): JS-side state flip (heading + CTA label)
   *   Phase 3 (in):   500ms inOut sin → matched-velocity emergence
   */
  /* Eye-icon crossfade for the password show/hide toggle.
   * showPassword=true → password text is visible → render the OPEN
   *                     eye (you can "see" it).
   * showPassword=false → password is masked → render the CLOSED eye.
   * Two icons stacked at the same position; opacity flips between
   * them so they crossfade rather than swap instantly. */
  const eyeAnim = useSharedValue(showPassword ? 1 : 0);
  useEffect(() => {
    eyeAnim.value = withTiming(showPassword ? 1 : 0, {
      duration: 220,
      easing: Easing.inOut(Easing.sin),
    });
  }, [showPassword, eyeAnim]);
  const openEyeStyle = useAnimatedStyle(() => ({
    opacity: eyeAnim.value,
  }));
  const closedEyeStyle = useAnimatedStyle(() => ({
    opacity: 1 - eyeAnim.value,
  }));

  const performModeSwap = useCallback(() => {
    setIsSignUp((s) => !s);
    setError('');
    modeAnim.value = withTiming(1, {
      duration: 500,
      easing: FADE_IN_EASING,
    });
  }, []);

  const toggleMode = useCallback(() => {
    if (isLoading || isGoogleLoading) return; // don't toggle mid-auth
    Keyboard.dismiss();
    modeAnim.value = withTiming(
      0,
      { duration: 420, easing: FADE_OUT_EASING },
      (finished) => {
        'worklet';
        if (finished) runOnJS(performModeSwap)();
      },
    );
  }, [isLoading, isGoogleLoading, performModeSwap]);

  /* Auth handlers — wiring preserved 1:1 from previous version */
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
      } else {
        let result = await signInWithEmail(trimmedEmail, trimmedPassword);
        let autopromoted = false;

        // Auto-promote: if signin failed because the email isn't in DB,
        // transparently create the account. The user typed credentials
        // expecting to sign in; we discovered they're new, so we just
        // sign them up with the same credentials. Beats showing "Invalid
        // email or password" and forcing them to manually toggle modes.
        if (!result.success && result.noAccount) {
          console.log('>>> No account found — auto-promoting to signup');
          autopromoted = true;
          const signUpResult = await signUpWithEmail(trimmedEmail, trimmedPassword);
          // Treat the signUp's outcome as the operation's outcome.
          result = signUpResult.needsOtpVerification
            ? { success: true }
            : signUpResult;
        }

        if (!result.success) {
          if (result.existingProvider === 'google') {
            setError('This email is linked to Google. Use "Continue with Google" below.');
          } else {
            setError(result.error || 'Sign in failed. Please try again.');
          }
        } else if (!autopromoted && params.mode === 'signin') {
          // Pure signin success from "I already have an account" entry.
          // The user has no fresh local progress (they bypassed pre-auth
          // onboarding), so deriving a step from cached AsyncStorage can
          // land them on /name-input or /personalize-intro from a stale
          // session — confusing. Route to /credibility, the canonical
          // first step. RouterGate overrides to /chat for users whose
          // onboarding is already complete server-side.
          //
          // The autopromote path is excluded because it transitions to
          // pendingOtp → /verify-email via RouterGate; manual navigation
          // here would race that.
          router.replace('/(onboarding)/credibility' as any);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, isSignUp, signUpWithEmail, signInWithEmail]);

  const handleGoogle = useCallback(async () => {
    Keyboard.dismiss();
    setError('');
    setIsGoogleLoading(true);

    console.log('[save-profile] handleGoogle start, params.mode =', params.mode ?? '(none)');

    // Compute the post-auth destination BEFORE awaiting Google. We don't
    // want any awaits between `signInWithGoogle()` resolving and the
    // navigation — that gap is where RouterGate would otherwise see
    // AuthState flip to authed-incomplete, race ahead, and redirect us
    // to /credibility (its default) before our manual replace fires.
    //
    // Routing matrix:
    //   mode=signin (existing-account claim from welcome)
    //     → /credibility. No fresh local progress. RouterGate overrides
    //       to /chat if the server profile is already onboarded.
    //   default mode (signup from your-reading) + finished chain
    //     → /permissions. User walked the chain; jump them ahead.
    //   default mode + unfinished chain (defensive)
    //     → /credibility.
    let destination: string;
    if (params.mode === 'signin') {
      destination = '/(onboarding)/credibility';
    } else {
      const finished = await hasFinishedPreAuthChain();
      destination = finished
        ? '/(onboarding)/permissions'
        : '/(onboarding)/credibility';
    }

    console.log('[save-profile] post-auth destination decided →', destination);

    try {
      console.log('[save-profile] awaiting signInWithGoogle…');
      await signInWithGoogle();
      console.log('[save-profile] signInWithGoogle resolved → router.replace', destination);
      // Synchronous after the await — no microtask gap for RouterGate
      // to slip a redirect into.
      router.replace(destination as any);
    } catch (err: any) {
      console.error('[save-profile] handleGoogle error:', err?.message || err);
      setError(err.message || 'Google sign in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  }, [signInWithGoogle, params.mode, router]);

  const strength = useMemo(() => strengthBuckets(password), [password]);
  const canSubmit = email.length > 0 && password.length > 0 && !isLoading;

  // Back-handler — ALWAYS router.replace, never router.back. The
  // canGoBack/back pattern is a backdoor for loops because the stack
  // history can lie (RouterGate.replace clears it; resume on app
  // reopen lands users here without /welcome or /your-reading
  // underneath). Explicit replace per entry mode is the only safe
  // pattern across this codebase.
  //
  //   signin mode  → /welcome     (came from "I already have an account")
  //   signup mode  → /your-reading (came from end of pre-auth onboarding)
  //
  // Block while auth is in flight to avoid phantom session state.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (isLoading || isGoogleLoading) return true;
        Keyboard.dismiss();
        const target = params.mode === 'signin'
          ? '/(onboarding)/welcome'
          : '/(onboarding)/your-reading';
        router.replace(target as any);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [isLoading, isGoogleLoading, params.mode, router]),
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar — back chevron mirrors the hardware-back: explicit
          router.replace per entry mode. Never router.back (see
          comment on the focus-effect handler above). */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => {
            const target = params.mode === 'signin'
              ? '/(onboarding)/welcome'
              : '/(onboarding)/your-reading';
            router.replace(target as any);
          }}
          style={styles.backBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.top, topStyle]}>
          {/* Heading copy is selected from THREE variants, not two:
                signin                          → "Welcome back."
                signup (from your-reading)      → "Save your small progress."
                signup (from welcome / fresh)   → "Make a quiet corner."
              The fresh-from-welcome variant doesn't pretend the user
              has progress; it frames the account as opening a quiet
              space to begin in. */}
          <Text style={styles.heading} numberOfLines={2}>
            {isSignUp ? (
              fromWelcome ? (
                <>
                  Make a <Text style={styles.headingItalic}>quiet</Text>{'\n'}
                  corner.
                </>
              ) : (
                <>
                  Save your <Text style={styles.headingItalic}>small</Text> progress.
                </>
              )
            ) : (
              <>
                {/* Forced line break so signin's heading occupies 2
                    lines like signup's. Same vertical rhythm in both
                    modes — eliminates the layout shift on toggle. */}
                Welcome{'\n'}
                <Text style={styles.headingItalic}>back</Text>.
              </>
            )}
          </Text>
          <Text style={styles.sub}>
            {isSignUp
              ? (fromWelcome
                  ? "Quick setup, then we'll begin together."
                  : "So future you doesn't start over.")
              : 'Sign in to pick up exactly where you left off.'}
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View style={[styles.form, formStyle]}>
          {/* Email */}
          <View style={[styles.field, { marginTop: 0 }]}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <View style={[styles.inputBox, emailFocused && styles.inputBoxFocused]}>
              <TextInput
                style={styles.input}
                placeholder="you@morning.co"
                placeholderTextColor={C.ink3}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
          </View>

          {/* Password */}
          <View style={[styles.field, { marginTop: 12 }]}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={[styles.inputBox, styles.inputBoxPassword, pwFocused && styles.inputBoxFocused]}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, !showPassword && password.length > 0 && styles.inputDots]}
                placeholder="at least 6 characters"
                placeholderTextColor={C.ink3}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                onSubmitEditing={handleAuth}
              />
              {/* Eye toggle, inside the input box on the right.
                  Wrap is 44×44 (full input height) so the entire
                  right-side region is tappable, not just the icon
                  silhouette. The visible glyphs stay 18px, centered. */}
              <TouchableOpacity
                onPress={() => setShowPassword((s) => !s)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                style={styles.eyeToggle}
                activeOpacity={0.7}
              >
                <Animated.View style={[StyleSheet.absoluteFillObject, styles.eyeIconCenter, openEyeStyle]}>
                  <Glyphs.EyeOpen size={18} color={C.coral} />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFillObject, styles.eyeIconCenter, closedEyeStyle]}>
                  <Glyphs.EyeShut size={18} color={C.coral} />
                </Animated.View>
              </TouchableOpacity>
            </View>

            {/* Strength meter slot — fixed height so signin/signup
                modes occupy identical vertical space. The meter itself
                only renders in signup mode; the slot reserves layout
                regardless. The whole form fades via formStyle, so no
                extra opacity wrapper is needed here. */}
            <View style={styles.strengthSlot}>
              {isSignUp && (
                <View>
                  <View style={styles.strengthRow}>
                    {[0, 1, 2, 3].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.strengthBar,
                          i < strength.filled && styles.strengthBarOn,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.strengthLabel}>{strength.label}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Primary CTA — fades together with the rest of the form
              via the parent formStyle. */}
          <TouchableOpacity
            style={[styles.primary, !canSubmit && styles.dim]}
            onPress={handleAuth}
            disabled={!canSubmit}
            activeOpacity={0.9}
          >
            {isLoading ? (
              <ActivityIndicator color={C.cream} size="small" />
            ) : (
              <View style={styles.primaryRow}>
                <Text style={styles.primaryText}>
                  {isSignUp ? 'Create account' : 'Sign in'}
                </Text>
                <Glyphs.Arrow size={13} color={C.cream} />
              </View>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR WITH GOOGLE</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={[styles.socialBtn, (isGoogleLoading || authLoading) && styles.dim]}
            onPress={handleGoogle}
            disabled={isGoogleLoading || authLoading}
            activeOpacity={0.85}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color={C.ink} size="small" />
            ) : (
              <>
                <GoogleMark size={18} />
                <Text style={styles.socialText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Toggle sign-in / sign-up — fades with the form via formStyle. */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={toggleMode}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.toggleLink}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
            </Text>
          </TouchableOpacity>

          {/* Terms footer */}
          <Text style={styles.terms}>
            By continuing you agree to our <Text style={styles.termsUnderline}>terms</Text> and{' '}
            <Text style={styles.termsUnderline}>privacy</Text>. We never sell data. Your writing is yours.
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream2 },

  topBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
    flexGrow: 1,
  },

  /* Reserve the FULL height of the worst-case heading + sub so the
   * form below doesn't shift between modes. Heading and sub render
   * with their natural spacing inside this reserved block — putting
   * minHeight on each text element directly created a phantom gap
   * between them when the heading was short.
   *
   * Worst case: signup heading 2 lines (76) + marginTop 10 + sub up
   * to 2 lines (40) ≈ 126. Plus 26 bottom margin to the form.
   */
  top: { marginBottom: 26, minHeight: 126 },
  heading: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 32, lineHeight: 40,
    letterSpacing: -0.2,
    color: C.ink,
  },
  headingItalic: {
    fontFamily: 'Fraunces-MediumItalic',
    color: C.ink,
  },
  sub: {
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5, lineHeight: 20,
    color: C.ink2,
    marginTop: 10,
    maxWidth: 290,
    letterSpacing: 0.1,
  },

  form: {},

  socialBtn: {
    width: '100%',
    marginTop: 14,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line2,
    borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12,
    minHeight: 50,
  },
  socialText: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 14, letterSpacing: 0.1,
    color: C.ink,
  },
  dim: { opacity: 0.55 },

  dividerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 22,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.line },
  dividerText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9, letterSpacing: 2.2,
    color: C.ink3,
  },

  field: { marginTop: 20 },
  fieldLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9, letterSpacing: 2.2,
    color: C.ink3,
  },
  /* Eye toggle — sits inside the password input box on the right.
   *
   * Width 44 to give a generous tap target (Apple's HIG minimum).
   * Height stretches to fill the input box (50px) via flex, so the
   * entire right-side band is tappable. Two glyphs stack with
   * absolute fill and crossfade open ↔ closed via the animated
   * styles. Coral matches the legacy SHOW/HIDE text color. */
  inputBoxPassword: {
    // Trim right padding so the eye toggle butts up to the right
    // edge instead of having an awkward gap. Left padding stays at
    // the default 16 so input text alignment is unchanged.
    paddingRight: 4,
  },
  eyeToggle: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBox: {
    marginTop: 6,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line2,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputBoxFocused: {
    borderWidth: 2, borderColor: C.ink,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: 'Fraunces-Text',
    fontSize: 15,
    color: C.ink,
    padding: 0,
    includeFontPadding: false,
  },
  inputDots: {
    letterSpacing: 4,
  },

  /* Fixed-height slot for the password-strength meter. Height fits
   * the strength row (8 marginTop + 2 bar) + label (6 marginTop + ~14
   * line) ≈ 30. Reserved in both modes so toggling doesn't reflow
   * the form below it. */
  strengthSlot: {
    minHeight: 30,
  },
  strengthRow: {
    flexDirection: 'row', gap: 4,
    marginTop: 8,
  },
  strengthBar: {
    flex: 1, height: 2, borderRadius: 1,
    backgroundColor: 'rgba(26,31,54,0.10)',
  },
  strengthBarOn: { backgroundColor: C.sage },
  strengthLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9, letterSpacing: 2.2,
    color: C.ink3,
    marginTop: 6,
  },

  errorBox: {
    marginTop: 16,
    backgroundColor: 'rgba(244,169,136,0.12)',
    borderWidth: 1, borderColor: 'rgba(244,169,136,0.4)',
    borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  errorText: {
    fontFamily: 'Fraunces-Text',
    fontSize: 13, lineHeight: 18,
    color: C.ink,
    textAlign: 'center',
  },

  primary: {
    marginTop: 22,
    backgroundColor: C.ink,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15, color: C.cream,
    letterSpacing: 0.2,
  },

  toggleRow: {
    marginTop: 14,
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    color: C.ink3,
  },
  toggleLink: {
    fontFamily: 'Fraunces-Text-Medium',
    color: C.ink,
    textDecorationLine: 'underline',
  },

  terms: {
    fontFamily: 'Fraunces-Text',
    fontSize: 11, lineHeight: 17,
    color: C.ink3,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 14,
  },
  termsUnderline: { textDecorationLine: 'underline', color: C.ink2 },
});
