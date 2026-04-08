/**
 * Auth Storage Service
 * Handles persistent session storage via AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoredSession, AuthProvider } from './types';

// Storage keys
const STORAGE_KEYS = {
  SESSION: '@mello_auth_session',
  EMAIL: '@mello_auth_email',
} as const;

/**
 * Save session to storage
 */
export async function saveSession(
  email: string,
  provider: AuthProvider,
  options?: {
    userId?: string;
    accessToken?: string;
    refreshToken?: string;
  }
): Promise<void> {
  const session: StoredSession = {
    email,
    provider,
    userId: options?.userId,
    accessToken: options?.accessToken,
    refreshToken: options?.refreshToken,
    loginStatus: true,
    timestamp: Date.now(),
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    console.log('>>> Session saved:', email, provider, options?.accessToken ? '(with token)' : '(no token)');
  } catch (error) {
    console.error('>>> Failed to save session:', error);
    throw error;
  }
}

/**
 * Get access token from stored session
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.accessToken || null;
}

/**
 * Get stored session
 */
export async function getSession(): Promise<StoredSession | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
    if (!data) return null;

    const session: StoredSession = JSON.parse(data);
    console.log('>>> Session retrieved:', session.email, session.provider);
    return session;
  } catch (error) {
    console.error('>>> Failed to get session:', error);
    return null;
  }
}

/**
 * Clear session from storage
 */
export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
    console.log('>>> Session cleared');
  } catch (error) {
    console.error('>>> Failed to clear session:', error);
    throw error;
  }
}

/**
 * Check if session exists
 */
export async function hasSession(): Promise<boolean> {
  const session = await getSession();
  return session !== null && session.loginStatus === true;
}

/**
 * Get session age in milliseconds
 */
export async function getSessionAge(): Promise<number | null> {
  const session = await getSession();
  if (!session) return null;
  return Date.now() - session.timestamp;
}
