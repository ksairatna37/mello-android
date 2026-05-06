/**
 * Welcome Screen — SelfMind redesign.
 *
 * Pre-auth landing for unauthenticated users. Two CTAs:
 *   - Begin gently             → /credibility (start onboarding)
 *   - I already have an account → /save-profile?mode=signin
 *
 * Authed users never see this screen — RouterGate routes them to
 * /chat (if onboarding_completed=true) or directly to the derived
 * onboarding step (if false). Welcome is purely the entry surface
 * for someone the app doesn't yet know.
 *
 * Hardware back: if local onboarding progress exists, show a soft
 * "Leave for now?" alert; otherwise exit the app.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Linking,
  BackHandler,
  Alert,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import SelfMindOrbV2 from '@/components/common/SelfMindOrbV2';
import { BRAND as C } from '@/components/common/BrandGlyphs';
import { getOnboardingData } from '@/utils/onboardingStorage';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  /* ─── Hardware back ───────────────────────────────────────────── */

  const backHandlingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (backHandlingRef.current) return true;
        backHandlingRef.current = true;

        (async () => {
          try {
            const data = await getOnboardingData();
            const hasProgress = !!(
              data.firstName ||
              data.qHeadWeather ||
              (data.emotionalBattery !== undefined && data.emotionalBattery !== null) ||
              (Array.isArray(data.personalizeTopics) && data.personalizeTopics.length > 0)
            );
            if (hasProgress) {
              Alert.alert(
                'Leave for now?',
                'Your progress is saved on this device. You can come back any time.',
                [
                  {
                    text: 'Stay',
                    style: 'cancel',
                    onPress: () => { backHandlingRef.current = false; },
                  },
                  {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: () => {
                      backHandlingRef.current = false;
                      BackHandler.exitApp();
                    },
                  },
                ],
                { onDismiss: () => { backHandlingRef.current = false; } },
              );
            } else {
              backHandlingRef.current = false;
              BackHandler.exitApp();
            }
          } catch {
            backHandlingRef.current = false;
            BackHandler.exitApp();
          }
        })();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

  /* ─── CTAs ────────────────────────────────────────────────────── */

  const handleGetStarted = () => {
    router.push('/(onboarding)/credibility' as any);
  };

  const handleAlreadyHaveAccount = () => {
    router.push('/(onboarding)/save-profile?mode=signin' as any);
  };

  /* ─── Entry fade — runs on every screen focus, not just initial mount ──
   *
   * One shared opacity drives BOTH the orb (orbWrap is wrapped) and the
   * surrounding content (wordmark, copy, CTAs, legal). On every focus we
   * reset to 0 and fade to 1, so a back-navigation return to this screen
   * gets the same coordinated entry as a cold mount — no orb snap.
   *
   * First focus: wait for orb's onReady (its WebView is loading from cold).
   * Subsequent focus: orb is already painted, so just play the fade after a
   * tiny delay that smooths the WebView surface re-attach.
   */
  const contentOpacity = useSharedValue(0);
  const contentFade = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const orbHasLoadedRef = useRef(false);
  const focusFadePendingRef = useRef(false);

  const playFade = useCallback(
    (delayMs: number) => {
      contentOpacity.value = 0;
      contentOpacity.value = withDelay(
        delayMs,
        withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
      );
    },
    [contentOpacity],
  );

  const handleOrbReady = useCallback(() => {
    orbHasLoadedRef.current = true;
    if (focusFadePendingRef.current) {
      focusFadePendingRef.current = false;
      playFade(0);
    }
  }, [playFade]);

  useFocusEffect(
    useCallback(() => {
      if (orbHasLoadedRef.current) {
        // Returning visit — orb is already mounted. Fade after a small delay
        // that covers the WebView surface re-attach on Android.
        playFade(120);
      } else {
        // First focus — wait for orb's onReady to drive the fade.
        focusFadePendingRef.current = true;
      }
      return () => {
        // Reset the "pending" flag in case the user navigates away before
        // the orb has loaded.
        focusFadePendingRef.current = false;
      };
    }, [playFade]),
  );

  // Safety net for the very first focus — if onReady never fires (WebView
  // module missing, load error), fade in anyway after a max wait.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!orbHasLoadedRef.current) playFade(0);
    }, 1500);
    return () => clearTimeout(t);
  }, [playFade]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        {/* Wordmark */}
        <Animated.Text style={[styles.wordmark, contentFade]}>
          self<Text style={styles.wordmarkItalic}>mind</Text>
        </Animated.Text>

        {/* Orb — wrapped in the same contentFade so the orb fades in lockstep
            with all other content on every focus (initial + back-return).
            disableInternalFade lets welcome own the timing. onReady kicks
            off the very first fade once the WebView has painted. */}
        <Animated.View style={[styles.orbWrap, contentFade]}>
          <SelfMindOrbV2 size={350} onReady={handleOrbReady} disableInternalFade />
        </Animated.View>

        {/* Copy */}
        <Animated.View style={[styles.copy, contentFade]}>
          <Text style={styles.headline}>
            A quieter place{'\n'}to <Text style={styles.headlineItalic}>think.</Text>
          </Text>
          <Text style={styles.body}>
            For the bracing feeling on a Tuesday. For the Sunday at 4pm. For the tabs in your head you never closed.
          </Text>
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View style={[styles.actions, contentFade]}>
          <TouchableOpacity style={styles.primary} onPress={handleGetStarted} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Begin, gently</Text>
            <Text style={styles.primaryArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghost} onPress={handleAlreadyHaveAccount} activeOpacity={0.6}>
            <Text style={styles.ghostText}>I already have an account</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.legal, contentFade]}>
          <Text style={styles.legalText}>
            By continuing you agree to SelfMind's{'\n'}
            <Text style={styles.legalLink} onPress={() => Linking.openURL('https://selfmind.app/terms')}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={styles.legalLink} onPress={() => Linking.openURL('https://selfmind.app/privacy')}>
              Privacy Policy
            </Text>
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  content: { flex: 1, paddingHorizontal: 24, backgroundColor: C.cream },
  orbWrap: {
    marginTop: 40,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    backgroundColor: C.cream,
  },
  wordmark: {
    fontSize: 22,
    fontFamily: 'Fraunces-Medium',
    color: C.ink,
    letterSpacing: -0.3,
  },
  wordmarkItalic: {
    fontFamily: 'Fraunces-MediumItalic',
  },
  copy: { marginTop: 40 },
  headline: {
    fontFamily: 'Fraunces',
    fontSize: 44,
    // Per docs/ANDROID_TEXT_CROPPING_NOTE.md — Fraunces descenders clip on
    // Android when lineHeight is too tight. Use fontSize+8 minimum.
    lineHeight: 55,
    letterSpacing: -1,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-Italic' },
  body: {
    fontFamily: 'Fraunces-Text',
    fontSize: 15,
    lineHeight: 24,
    color: C.ink2,
    marginTop: 18,
    maxWidth: 320,
  },
  spacer: { flex: 1, minHeight: 24 },
  actions: { gap: 10 },
  primary: {
    backgroundColor: C.ink,
    paddingVertical: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: C.cream,
    letterSpacing: 0.2,
  },
  primaryArrow: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: C.cream,
  },
  ghost: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink2,
  },
  legal: { marginTop: 14, alignItems: 'center' },
  legalText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: C.ink3,
    textAlign: 'center',
  },
  legalLink: {
    color: C.ink,
    textDecorationLine: 'underline',
  },
});
