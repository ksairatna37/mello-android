/**
 * Mello Root Layout
 * Sets up providers, fonts, and handles initial routing
 * Includes AuthProvider for Google OAuth
 */

import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as Linking from 'expo-linking';
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
import { AnimatedSplash } from '@/components/common/AnimatedSplash';
import { AuthProvider } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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
          // Brand font for "mello" logo
          'Playwrite': PlaywriteHRLijeva_400Regular,
        });
        setFontsLoaded(true);
      } catch (error) {
        console.error('Error loading fonts:', error);
        setFontsLoaded(true); // Continue anyway
      }
    }

    loadFonts();
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

  if (showSplash) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <AnimatedSplash onComplete={handleSplashComplete} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(main)" />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
