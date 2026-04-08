/**
 * Auth Service Types
 * Types specific to authentication service
 */

// Auth provider type
export type AuthProvider = 'email' | 'google';

// Stored session data
export interface StoredSession {
  email: string;
  userId?: string;
  provider: AuthProvider;
  accessToken?: string;
  refreshToken?: string;
  loginStatus: boolean;
  timestamp: number;
}

// Auth result from service
export interface AuthResult {
  success: boolean;
  email?: string;
  userId?: string;
  error?: string;
  needsOtpVerification?: boolean;
  existingProvider?: AuthProvider; // Set when email exists with different provider
}

// Email check result
export interface EmailCheckResult {
  exists: boolean;
  provider?: AuthProvider;
  error?: string;
}

// User state for context
export interface AuthUser {
  email: string;
  userId?: string;
  provider: AuthProvider;
  isAuthenticated: boolean;
}
