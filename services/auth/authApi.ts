/**
 * Auth API Service
 * Backend API calls for email/password authentication
 */

import { post } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { supabase } from '@/lib/supabase';
import type {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ResendOtpRequest,
  ResendOtpResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ConfirmResetRequest,
  ConfirmResetResponse,
  SetPasswordRequest,
  SetPasswordResponse,
} from '@/api/types';
import type { AuthResult, EmailCheckResult, AuthProvider } from './types';

/**
 * Check if email exists in profiles table and determine auth provider
 * Uses Supabase direct query to profiles table
 */
export async function checkEmailProvider(email: string): Promise<EmailCheckResult> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email_id, login_detail')
      .eq('email_id', email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('>>> Error checking email provider:', error);
      return { exists: false };
    }

    if (!data) {
      return { exists: false };
    }

    // Check login_detail to determine provider
    // Google OAuth users typically have login_detail with provider info
    let provider: AuthProvider = 'email';

    if (data.login_detail) {
      const loginDetail = data.login_detail as Record<string, unknown>;
      if (loginDetail.provider === 'google' || loginDetail.google) {
        provider = 'google';
      }
    }

    // Alternative: Check if user was created via OAuth by checking auth.users identities
    // But we can't query auth.users directly from client, so we rely on login_detail

    return { exists: true, provider };
  } catch (error) {
    console.error('>>> Error in checkEmailProvider:', error);
    return { exists: false, error: 'Failed to check email' };
  }
}

/**
 * Sign up with email and password
 * Returns user_id and profile on success
 * User must verify OTP before they can login
 *
 * If email exists with Google OAuth, returns existingProvider: 'google'
 */
export async function signup(
  email: string,
  password: string
): Promise<AuthResult> {
  // Client-side validation
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Invalid email format' };
  }

  const response = await post<SignupResponse, SignupRequest>(
    ENDPOINTS.AUTH_SIGNUP,
    { email, password }
  );

  if (response.error) {
    // Map backend errors to user-friendly messages
    if (response.error.status === 409) {
      // Email already exists - check if it was registered with Google
      const emailCheck = await checkEmailProvider(email);
      if (emailCheck.exists && emailCheck.provider === 'google') {
        return {
          success: false,
          error: 'This email is registered with Google. Please sign in with Google instead.',
          existingProvider: 'google',
        };
      }
      return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
    }
    if (response.error.status === 400) {
      return { success: false, error: response.error.message || 'Invalid signup data' };
    }
    return { success: false, error: response.error.message };
  }

  if (response.data?.user_id) {
    return {
      success: true,
      email: response.data.email,
      userId: response.data.user_id,
      needsOtpVerification: true,
    };
  }

  return { success: false, error: 'Signup failed. Please try again.' };
}

/**
 * Verify OTP sent to email during signup
 */
export async function verifyOtp(
  email: string,
  otp: string
): Promise<AuthResult> {
  if (!email || !otp) {
    return { success: false, error: 'Email and OTP are required' };
  }

  if (otp.length !== 6) {
    return { success: false, error: 'OTP must be 6 digits' };
  }

  const response = await post<VerifyOtpResponse, VerifyOtpRequest>(
    ENDPOINTS.AUTH_VERIFY_OTP,
    { email, otp }
  );

  if (response.error) {
    if (response.error.status === 400) {
      return { success: false, error: 'Invalid or expired OTP' };
    }
    return { success: false, error: response.error.message };
  }

  if (response.data?.user_id) {
    return {
      success: true,
      email: response.data.email,
      userId: response.data.user_id,
    };
  }

  return { success: false, error: 'Verification failed. Please try again.' };
}

/**
 * Resend OTP to email
 */
export async function resendOtp(email: string): Promise<AuthResult> {
  if (!email) {
    return { success: false, error: 'Email is required' };
  }

  const response = await post<ResendOtpResponse, ResendOtpRequest>(
    ENDPOINTS.AUTH_RESEND_OTP,
    { email }
  );

  if (response.error) {
    return { success: false, error: response.error.message };
  }

  return { success: true, email };
}

/**
 * Login with email and password
 * Returns access_token and refresh_token on success
 *
 * If email exists with Google OAuth, returns existingProvider: 'google'
 */
export async function login(
  email: string,
  password: string
): Promise<AuthResult & { accessToken?: string; refreshToken?: string }> {
  // Client-side validation
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const response = await post<LoginResponse, LoginRequest>(
    ENDPOINTS.AUTH_LOGIN,
    { email, password }
  );

  if (response.error) {
    // Map backend errors to user-friendly messages
    if (response.error.status === 401) {
      // Check if user exists with Google OAuth
      const emailCheck = await checkEmailProvider(email);
      if (emailCheck.exists && emailCheck.provider === 'google') {
        return {
          success: false,
          error: 'This account uses Google Sign-In. Please sign in with Google instead.',
          existingProvider: 'google',
        };
      }
      return { success: false, error: 'Invalid email or password' };
    }
    if (response.error.status === 403) {
      return { success: false, error: 'Please verify your email first' };
    }
    if (response.error.status === 400) {
      return { success: false, error: 'Invalid login data' };
    }
    return { success: false, error: response.error.message };
  }

  if (response.data?.access_token) {
    return {
      success: true,
      email: response.data.email,
      userId: response.data.user_id,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    };
  }

  return { success: false, error: 'Login failed. Please try again.' };
}

/**
 * Request password reset (sends OTP to email)
 */
export async function resetPassword(email: string): Promise<AuthResult> {
  if (!email) {
    return { success: false, error: 'Email is required' };
  }

  const response = await post<ResetPasswordResponse, ResetPasswordRequest>(
    ENDPOINTS.AUTH_RESET_PASSWORD,
    { email }
  );

  if (response.error) {
    return { success: false, error: response.error.message };
  }

  return { success: true, email };
}

/**
 * Confirm password reset with OTP and new password
 */
export async function confirmReset(
  email: string,
  otp: string,
  newPassword: string
): Promise<AuthResult> {
  if (!email || !otp || !newPassword) {
    return { success: false, error: 'All fields are required' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  const response = await post<ConfirmResetResponse, ConfirmResetRequest>(
    ENDPOINTS.AUTH_CONFIRM_RESET,
    { email, otp, new_password: newPassword }
  );

  if (response.error) {
    if (response.error.status === 400) {
      return { success: false, error: 'Invalid or expired OTP' };
    }
    return { success: false, error: response.error.message };
  }

  if (response.data?.user_id) {
    return {
      success: true,
      email,
      userId: response.data.user_id,
    };
  }

  return { success: false, error: 'Password reset failed. Please try again.' };
}

/**
 * Set password for OAuth users who don't have one
 */
export async function setPassword(
  email: string,
  newPassword: string
): Promise<AuthResult> {
  if (!email || !newPassword) {
    return { success: false, error: 'Email and password are required' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  const response = await post<SetPasswordResponse, SetPasswordRequest>(
    ENDPOINTS.AUTH_SET_PASSWORD,
    { email, new_password: newPassword }
  );

  if (response.error) {
    if (response.error.status === 409) {
      return { success: false, error: 'Password already set for this account' };
    }
    if (response.error.status === 404) {
      return { success: false, error: 'User not found' };
    }
    return { success: false, error: response.error.message };
  }

  if (response.data?.user_id) {
    return {
      success: true,
      email,
      userId: response.data.user_id,
    };
  }

  return { success: false, error: 'Failed to set password. Please try again.' };
}
