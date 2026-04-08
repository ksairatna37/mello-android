/**
 * Auth Service - Barrel Export
 */

// API functions
export {
  signup,
  login,
  verifyOtp,
  resendOtp,
  resetPassword,
  confirmReset,
  setPassword,
  checkEmailProvider,
} from './authApi';

// Storage functions
export {
  saveSession,
  getSession,
  clearSession,
  hasSession,
  getSessionAge,
  getAccessToken,
} from './authStorage';

// Types
export type {
  AuthProvider,
  StoredSession,
  AuthResult,
  AuthUser,
  EmailCheckResult,
} from './types';
