/**
 * Supabase Client for Mello Android
 *
 * Uses AsyncStorage for token storage (handles large JWTs)
 * Configured for Google OAuth with Supabase
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Supabase configuration
const SUPABASE_URL = 'https://drepvbrhkxzwtwqncnyd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZXB2YnJoa3h6d3R3cW5jbnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjkzOTczMjQsImV4cCI6MjA0NDk3MzMyNH0.OJCaAJBAxZfrydgUfm1A_ECFL3uCOmYX33rjCETcNQw';

/**
 * AsyncStorage adapter for Supabase auth
 * Uses AsyncStorage which can handle large values (unlike SecureStore's 2048 byte limit)
 */
const AsyncStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('AsyncStorage getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('AsyncStorage setItem error:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('AsyncStorage removeItem error:', error);
    }
  },
};

/**
 * Supabase client instance
 *
 * Features:
 * - Token storage via AsyncStorage (handles large JWTs)
 * - Auto token refresh
 * - Session persistence
 * - Web fallback support
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Handled manually for React Native
  },
});

// Export config for use elsewhere
export { SUPABASE_URL, SUPABASE_ANON_KEY };
