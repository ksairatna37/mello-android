/**
 * LiveKit Service for Hindi Voice (Sarvam AI)
 *
 * Connects to LiveKit room via webapp API for Hindi voice conversations.
 * The Python Sarvam agent joins the same room for bidirectional audio.
 */

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface LiveKitConnectionData {
  token: string;
  serverUrl: string;
  roomName: string;
  language: string;
}

export interface LiveKitTokenResponse {
  success: boolean;
  token?: string;
  livekitUrl?: string;
  roomName?: string;
  language?: string;
  message?: string;
}

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

import { ENV } from '@/config/env';

const LIVEKIT_API_URL = ENV.livekitApiUrl || 'http://localhost:3001/api/livekit-token';

// ═══════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════

/**
 * Fetch a LiveKit token from the webapp server
 */
export async function fetchLiveKitToken(
  userId?: string,
  userName?: string,
): Promise<LiveKitConnectionData> {
  console.log('[LiveKit] Requesting token from:', LIVEKIT_API_URL);

  const response = await fetch(LIVEKIT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      language: 'hi-IN',
      userId: userId || `user-${Date.now()}`,
      userName: userName || 'User',
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: LiveKitTokenResponse = await response.json();

  if (!data.success || !data.token || !data.livekitUrl) {
    throw new Error(data.message || 'Failed to create voice session');
  }

  console.log('[LiveKit] Token received for room:', data.roomName);

  return {
    token: data.token,
    serverUrl: data.livekitUrl,
    roomName: data.roomName || 'mello-hindi-voice',
    language: data.language || 'hi-IN',
  };
}

/**
 * Check if LiveKit API is configured
 */
export function isLiveKitConfigured(): boolean {
  return Boolean(ENV.livekitApiUrl);
}

/**
 * Get the configured API URL (for debugging)
 */
export function getLiveKitApiUrl(): string {
  return LIVEKIT_API_URL;
}
