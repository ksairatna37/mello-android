/**
 * Mello Root Layout
 * Sets up providers, fonts, and handles initial routing
 * Includes AuthProvider for Google OAuth
 */

// Polyfills must be imported before any hume SDK usage
import '../polyfills';

import React, { useState, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as Linking from 'expo-linking';
import { flushPending as flushPendingPracticeWrites } from '@/services/practice/practiceProfileSync';
import { configureNotificationRuntime } from '@/services/notifications/notificationService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Outfit_100Thin,
  Outfit_200ExtraLight,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';
import {
  PlaywriteHRLijeva_400Regular,
} from '@expo-google-fonts/playwrite-hr-lijeva';
import {
  DMSerifDisplay_400Regular,
} from '@expo-google-fonts/dm-serif-display';
import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium_Italic,
} from '@expo-google-fonts/fraunces';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedSplash } from '@/components/common/AnimatedSplash';
import { AuthProvider } from '@/contexts/AuthContext';
import { RouterGate } from '@/app/_components/RouterGate';
import SelfMindOrbV2 from '@/components/common/SelfMindOrbV2';
import { supabase } from '@/lib/supabase';
import { migrateOnboardingData } from '@/utils/onboardingStorage';
import { View, StyleSheet } from 'react-native';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'Outfit-Thin': Outfit_100Thin,
          'Outfit-ExtraLight': Outfit_200ExtraLight,
          'Outfit-Light': Outfit_300Light,
          'Outfit-Regular': Outfit_400Regular,
          'Outfit-Medium': Outfit_500Medium,
          'Outfit-SemiBold': Outfit_600SemiBold,
          'Outfit-Bold': Outfit_700Bold,
          'Outfit-ExtraBold': Outfit_800ExtraBold,
          'Outfit-Black': Outfit_900Black,
          // Brand font for "mello" logo (legacy)
          'Playwrite': PlaywriteHRLijeva_400Regular,
          // Serif accent font — use fontFamily: 'DMSerif' (legacy)
          'DMSerif': DMSerifDisplay_400Regular,
          // SelfMind brand fonts — match the website/design system.
          //
          // Fraunces has an optical-size axis (9..144). Web interpolates
          // automatically. On native we pick static cuts per size range:
          //
          //   "Fraunces"     → 72pt cut (for 20–44 px headlines). Feels
          //                    right at h1 sizes — strokes thick enough
          //                    to not look anemic like the 144pt cut did.
          //   "Fraunces-XL"  → 144pt cut (for 40+ px wordmarks/splash).
          //   "Fraunces-Text" → 9pt cut (for 11–16 px body copy).
          'Fraunces':                require('@/assets/fonts/Fraunces72pt-Regular.ttf'),
          'Fraunces-Italic':         require('@/assets/fonts/Fraunces72pt-Italic.ttf'),
          'Fraunces-Medium':         require('@/assets/fonts/Fraunces72pt-SemiBold.ttf'),
          'Fraunces-MediumItalic':   require('@/assets/fonts/Fraunces72pt-SemiBoldItalic.ttf'),
          'Fraunces-XL':             require('@/assets/fonts/Fraunces144pt-Regular.ttf'),
          'Fraunces-XL-Italic':      require('@/assets/fonts/Fraunces144pt-Italic.ttf'),
          'Fraunces-XL-Medium':      require('@/assets/fonts/Fraunces144pt-SemiBold.ttf'),
          'Fraunces-XL-MediumItalic':require('@/assets/fonts/Fraunces144pt-SemiBoldItalic.ttf'),
          'Fraunces-Text':           Fraunces_400Regular,
          'Fraunces-Text-Italic':    Fraunces_400Regular_Italic,
          'Fraunces-Text-Medium':    Fraunces_500Medium,
          'Fraunces-Text-MediumItalic': Fraunces_500Medium_Italic,
          'Inter-Light': Inter_300Light,
          'Inter-Regular': Inter_400Regular,
          'Inter-Medium': Inter_500Medium,
          'Inter-SemiBold': Inter_600SemiBold,
          'Inter-Bold': Inter_700Bold,
          'JetBrainsMono': JetBrainsMono_400Regular,
          'JetBrainsMono-Medium': JetBrainsMono_500Medium,
          // Vector icons — preload to avoid Metro asset-download errors
          ...Ionicons.font,
        });
        setFontsLoaded(true);
      } catch (error) {
        console.error('Error loading fonts:', error);
        setFontsLoaded(true); // Continue anyway
      }
    }

    loadFonts();
  }, []);

  // Strip legacy onboarding-storage keys left over from the
  // pre-redesign flow. Idempotent and runs once on boot.
  useEffect(() => {
    migrateOnboardingData();
  }, []);

  useEffect(() => {
    void configureNotificationRuntime();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const route = typeof data.route === 'string' ? data.route : null;
      if (!route) return;
      const params = (
        data.params &&
        typeof data.params === 'object' &&
        !Array.isArray(data.params)
      ) ? data.params as Record<string, string> : undefined;
      if (params) {
        router.push({ pathname: route, params } as any);
        return;
      }
      router.push(route as any);
    });
    return () => { sub.remove(); };
  }, []);

  /* Flush any pending practice PATCHes when the app moves to
   * background. The OS may kill the process at any point after that
   * (especially on memory-constrained Android), and the 300ms
   * debounce window is the most common timing for "I just tapped the
   * heart and the app died" loss paths. flushPending() cancels the
   * timers and fires the PATCHes immediately; we don't await (the
   * listener can't be async-blocking) — the request races the
   * process kill, but the window shrinks from 300ms to just network.
   *
   * IMPORTANT: gated on 'background' ONLY, not 'inactive'. iOS fires
   * 'inactive' for transient interruptions (Control Center pull-down,
   * notification banner peek, app-switcher view) where the process
   * is NOT at risk of being killed. Flushing on those events would
   * defeat the debounce coalescing for no durability gain. */
  useEffect(() => {
    const handleStateChange = (next: AppStateStatus) => {
      if (next === 'background') {
        console.log('[App] AppState=background → flush pending practice writes');
        void flushPendingPracticeWrites();
      }
    };
    const sub = AppState.addEventListener('change', handleStateChange);
    return () => { sub.remove(); };
  }, []);

  // Handle deep links for OAuth callback
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (url && url.includes('auth/callback')) {
        console.log('OAuth callback received:', url);
        try {
          // Parse the URL to extract tokens
          const parsedUrl = new URL(url);
          const params = new URLSearchParams(parsedUrl.hash.substring(1));

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            console.log('Session set from deep link');
          }
        } catch (error) {
          console.error('Error handling OAuth callback:', error);
        }
      }
    };

    // Get initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (!fontsLoaded) {
    return null;
  }

  // Pre-warm the WebView native module + JS engine + paint pipeline so the
  // first real orb (welcome / analysing / your-reading / welcome-aboard)
  // appears in the same frame as its screen instead of a beat after.
  //
  // Hoisted ABOVE the showSplash conditional so the warmer is a stable
  // sibling — without this, flipping showSplash unmounts and re-mounts the
  // warmer at exactly the moment welcome is about to appear, throwing away
  // the warming we paid for.
  //
  // `warmOnly` skips the rAF animation loop inside the WebView so this
  // hidden surface doesn't burn CPU/GPU forever — we only want it to keep
  // the WebView native module + JS context loaded, not to actually paint
  // a continuously-morphing orb the user can't see.
  //
  // 64×64 (not 1×1 — Android skips composing 1px views, defeating the
  // warm), fully off-screen, opacity 0, no input, hidden from TalkBack.
  const orbWarmer = (
    <View style={styles.orbWarmer} pointerEvents="none">
      <SelfMindOrbV2 size={64} warmOnly />
    </View>
  );

  // Single GestureHandlerRootView with the warmer as a STABLE sibling — the
  // splash → post-splash flip swaps only the foreground tree, the warmer
  // mount is preserved across the transition (don't move it inside either
  // branch or React will treat it as a remount).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {showSplash ? (
        <>
          <StatusBar style="dark" />
          <AnimatedSplash onComplete={handleSplashComplete} />
        </>
      ) : (
        <AuthProvider>
          <RouterGate>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                // Paint the screen container cream so transitions never reveal a
                // dark surface underneath. Pairs with android:windowBackground in
                // styles.xml — together they kill the back-press dark flash.
                contentStyle: { backgroundColor: '#FBF5EE' },
              }}
            >
              <Stack.Screen name="index" />
              {/* (main) entry uses fade — the documented handoff is from
                  /welcome-aboard after completeOnboarding succeeds. A
                  slide-from-right would feel like a step sideways instead
                  of a soft transition into the main app. */}
              <Stack.Screen name="(main)" options={{ animation: 'fade' }} />
              <Stack.Screen name="change-password" />
            </Stack>
          </RouterGate>
        </AuthProvider>
      )}
      {orbWarmer}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  orbWarmer: {
    position: 'absolute',
    width: 64,
    height: 64,
    top: -200,
    left: -200,
    opacity: 0,
  },
});
