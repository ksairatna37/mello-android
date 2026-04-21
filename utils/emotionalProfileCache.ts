/**
 * Emotional Profile Cache
 *
 * Stores the Bedrock-generated emotional profile in AsyncStorage so the
 * result is ready before the user navigates to the mindwave screen.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EmotionalProfile } from '@/services/chat/bedrockService';

const KEY = 'emotionalProfileCache';

export async function saveEmotionalProfile(profile: EmotionalProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // non-critical
  }
}

export async function getEmotionalProfile(): Promise<EmotionalProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EmotionalProfile) : null;
  } catch {
    return null;
  }
}

export async function clearEmotionalProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // non-critical
  }
}
