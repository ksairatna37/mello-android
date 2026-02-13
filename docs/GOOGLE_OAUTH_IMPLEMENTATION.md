# Google OAuth Implementation Guide for Mello Android

## Overview

This document extracts the Google OAuth ("Continue with Google") implementation from the Mello web app (pixel-perfect-replicator-x) for use in the Mello Android app.

---

## Flow Summary (From Screenshots)

```
Step 1: User clicks "Continue with Google" button on signin/signup page
   ↓
Step 2: Redirects to Google Account Chooser (accounts.google.com)
        - Shows list of Google accounts
        - User selects their account
   ↓
Step 3: Google Consent Screen
        - Shows app name (drepvbrhkxzwtwqncnyd.supabase.co)
        - Requests: Name, profile picture, email address
        - User clicks "Continue"
   ↓
Step 4: Redirect back to app with auth session
        - Supabase handles the OAuth callback
        - User is now authenticated
```

---

## Current Web App Auth Flow (Visual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MELLO WEB - GOOGLE AUTH FLOW                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   User on    │
│ SignIn Page  │
└──────┬───────┘
       │
       │ clicks "Continue with Google"
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  signInWithGoogle()                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ supabase.auth.signInWithOAuth({                                 │ │
│  │   provider: 'google',                                           │ │
│  │   options: { redirectTo: '${origin}/onboarding' }               │ │
│  │ })                                                              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
       │
       │ Browser redirects to Google
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  GOOGLE OAUTH FLOW (External)                                        │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │   Account    │───▶│   Consent    │───▶│ Redirect to Supabase │   │
│  │   Chooser    │    │   Screen     │    │     with tokens      │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
       │
       │ Supabase processes OAuth callback
       │ Creates/updates user in auth.users
       │ Redirects to app with session
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  onAuthStateChange('SIGNED_IN')                                      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 1. storeLoginTimestamp(user.id)                                │  │
│  │ 2. searchEmail(user.email) → returns status                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
       │
       │ Check email status
       ▼
   ┌───┴───────────────────────────────────────────┐
   │                                               │
   ▼                   ▼                           ▼
┌──────────┐    ┌──────────────┐           ┌─────────────┐
│status=-1 │    │  status=0    │           │  status=1   │
│ NEW USER │    │ NEEDS SETUP  │           │  EXISTING   │
└────┬─────┘    └──────┬───────┘           └──────┬──────┘
     │                 │                          │
     ▼                 ▼                          ▼
┌──────────────┐ ┌──────────────┐          ┌──────────────┐
│updateProfile │ │   Navigate   │          │   Navigate   │
│   Data()     │ │/onboarding   │          │      /       │
└──────┬───────┘ └──────────────┘          └──────────────┘
       │
       ▼
┌──────────────┐
│   Navigate   │
│ /onboarding  │
└──────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                              EMAIL STATUS LOGIC                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   status = -1  →  Email NOT found in profiles table                         │
│                   User is completely new                                    │
│                   Action: Create profile, then onboarding                   │
│                                                                             │
│   status =  0  →  Email found, first_login = false                          │
│                   User started signup but didn't complete onboarding        │
│                   Action: Navigate to onboarding                            │
│                                                                             │
│   status =  1  →  Email found, first_login = true                           │
│                   User has completed onboarding before                      │
│                   Action: Navigate to home (/)                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROFILE UPDATE FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   updateProfileData(user, referralCode)                                     │
│   │                                                                         │
│   ├─▶ Generate referral code: referralCodeCreator(user.email)               │
│   │                                                                         │
│   ├─▶ Check referral: searchReferal(referralCode)                           │
│   │   │                                                                     │
│   │   ├─▶ If referrer found:                                                │
│   │   │   • updateReferralCount(referrer)                                   │
│   │   │   • Update profile with referd_by = referrer.id                     │
│   │   │                                                                     │
│   │   └─▶ If no referrer:                                                   │
│   │       • Update profile without referd_by                                │
│   │                                                                         │
│   └─▶ Set profile fields:                                                   │
│       • email_id = user.email                                               │
│       • referral_code = generated code                                      │
│       • first_login = false (will become true after onboarding)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPLETE USER JOURNEY DIAGRAM                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   NEW USER:                                                                 │
│   ─────────                                                                 │
│   SignIn Page                                                               │
│       │                                                                     │
│       ├──▶ "Continue with Google"                                           │
│       │       │                                                             │
│       │       ├──▶ Google OAuth (account select + consent)                  │
│       │       │       │                                                     │
│       │       │       └──▶ Supabase callback                                │
│       │       │               │                                             │
│       │       │               └──▶ onAuthStateChange('SIGNED_IN')           │
│       │       │                       │                                     │
│       │       │                       └──▶ searchEmail() → -1 (new)         │
│       │       │                               │                             │
│       │       │                               └──▶ updateProfileData()      │
│       │       │                                       │                     │
│       │       │                                       └──▶ /onboarding      │
│       │       │                                               │             │
│       │       │                                               └──▶ Complete │
│       │       │                                                    onboard  │
│       │       │                                                       │     │
│       │       │                                                       └──▶/ │
│                                                                             │
│   RETURNING USER:                                                           │
│   ───────────────                                                           │
│   SignIn Page                                                               │
│       │                                                                     │
│       └──▶ "Continue with Google"                                           │
│               │                                                             │
│               └──▶ Google OAuth (usually auto-selects account)              │
│                       │                                                     │
│                       └──▶ onAuthStateChange('SIGNED_IN')                   │
│                               │                                             │
│                               └──▶ searchEmail() → 1 (exists)               │
│                                       │                                     │
│                                       └──▶ / (home)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Supabase Configuration

### Project Details
```
SUPABASE_URL: https://drepvbrhkxzwtwqncnyd.supabase.co
SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZXB2YnJoa3h6d3R3cW5jbnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjkzOTczMjQsImV4cCI6MjA0NDk3MzMyNH0.OJCaAJBAxZfrydgUfm1A_ECFL3uCOmYX33rjCETcNQw
```

### Auth Settings (from supabase/config.toml)
```toml
[auth]
site_url = "https://melloaihealth-chatbot-ftf4emdzewhkeac2.centralindia-01.azurewebsites.net/"
additional_redirect_urls = ["https://melloaihealth-chatbot-ftf4emdzewhkeac2.centralindia-01.azurewebsites.net/"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_signup = true
enable_confirmations = false
```

---

## Core Implementation (Web Version)

### 1. Supabase Client Setup
**File: `src/integrations/supabase/client.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://drepvbrhkxzwtwqncnyd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
  }
});
```

### 2. Google Sign-In Function
**File: `src/contexts/AuthContext.tsx`**

```typescript
// Sign in with Google
const signInWithGoogle = async () => {
  try {
    const referralCode = new URLSearchParams(window.location.search).get('ref');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/onboarding`,
      }
    });

    console.log('Google sign in data:', data);
    if (error) {
      toast.error(error.message);
      throw error;
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Google Sign in error:', error.message);
    } else {
      console.error('Google Sign in error:', error);
    }
    throw error;
  }
};
```

### 3. Auth State Change Handler
**File: `src/contexts/AuthContext.tsx`**

```typescript
useEffect(() => {
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      (async () => {
        try {
          await storeLoginTimestamp(session.user.id);
          const emailStatus = await searchEmail(session.user.email!);

          // emailStatus === 1: User exists, first_login is true (onboarded)
          // emailStatus === 0: User exists, first_login is false (needs onboarding)
          // emailStatus === -1: User profile not found (new user)

          if (emailStatus === -1) {
            // New user - create profile
            await updateProfileData(session.user, referralCode);
          } else if (emailStatus === 0) {
            // Existing user, needs onboarding
            navigate('/onboarding');
          } else if (emailStatus === 1) {
            // Existing user, onboarded - go to home
            navigate('/');
          }
        } catch (error) {
          console.error("Error during SIGNED_IN processing:", error);
          navigate('/');
        }
      })();
    }
  });

  return () => {
    authListener?.subscription.unsubscribe();
  };
}, [navigate]);
```

### 4. UI Component (Sign In Page)
**File: `src/pages/SignIn.tsx`**

```tsx
import { FcGoogle } from "react-icons/fc";
import { LogIn } from "lucide-react";

const SignIn = () => {
  const { signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign in failed:', error);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full bg-white space-x-2 py-2.5 hover:bg-gray-50 transition-colors"
      onClick={handleGoogleSignIn}
    >
      <LogIn className="w-5 h-5" />
      <span>Continue with</span>
      <FcGoogle className="w-5 h-5" />
    </Button>
  );
};
```

---

## Profile Data Structure

### Profile Interface
```typescript
interface Profile {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  email_id?: string | null;
  first_login?: boolean | null;
  referd_by?: string | null;
  referral_code?: string | null;
  created_at?: string;
  updated_at?: string;
  twitter_connected?: boolean | null;
  wallet_address?: string | null;
  wallet_chain?: string | null;
  wallet_connected?: boolean | null;
}
```

### Profile Update Function
```typescript
const updateProfileData = async (user, referralCode) => {
  const referal = await referralCodeCreator(user.email);
  try {
    const refered = await searchReferal(referralCode);

    if (refered && Object.keys(refered).length > 0) {
      await updateReferralCount(refered);
      await supabase
        .from('profiles')
        .update({
          email_id: user.email,
          referd_by: refered.id,
          referral_code: referal,
          first_login: false
        })
        .eq('id', user.id)
        .select();
    } else {
      await supabase
        .from('profiles')
        .update({
          email_id: user.email,
          referral_code: referal,
          first_login: false
        })
        .eq('id', user.id)
        .select();
    }
  } catch (error) {
    console.error('Profile creation error:', error.message);
  }
};
```

---

## React Native Adaptation

### Required Dependencies
```bash
npx expo install @supabase/supabase-js expo-auth-session expo-web-browser expo-crypto
```

### Key Differences for React Native

1. **Storage**: Use `expo-secure-store` instead of `localStorage`
2. **OAuth Flow**: Use `expo-auth-session` for OAuth redirects
3. **Deep Linking**: Configure URL scheme for callback

### Supabase Client for React Native
```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  'https://drepvbrhkxzwtwqncnyd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

### Google Sign-In for React Native
```typescript
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const signInWithGoogle = async () => {
  try {
    const redirectUrl = makeRedirectUri({
      scheme: 'mello',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      if (result.type === 'success') {
        const { url } = result;
        // Extract tokens from URL and set session
        await supabase.auth.getSession();
      }
    }
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  }
};
```

---

## URL Scheme Configuration

### app.json / app.config.js
```json
{
  "expo": {
    "scheme": "mello",
    "ios": {
      "bundleIdentifier": "com.mello.app"
    },
    "android": {
      "package": "com.mello.app"
    }
  }
}
```

### Deep Link Handler (app/_layout.tsx)
```typescript
import { useURL } from 'expo-linking';

const url = useURL();

useEffect(() => {
  if (url) {
    // Handle the deep link callback
    const { queryParams } = Linking.parse(url);
    if (queryParams?.access_token) {
      supabase.auth.setSession({
        access_token: queryParams.access_token,
        refresh_token: queryParams.refresh_token,
      });
    }
  }
}, [url]);
```

---

## Supabase Dashboard Configuration

### Required Settings in Supabase Dashboard

1. **Authentication > Providers > Google**
   - Enable Google provider
   - Add Google OAuth credentials (Client ID & Secret)

2. **Authentication > URL Configuration**
   - Site URL: `mello://`
   - Redirect URLs:
     - `mello://auth/callback`
     - `https://melloai.health/auth/callback`
     - `exp://localhost:8081` (for development)

3. **Google Cloud Console**
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `https://drepvbrhkxzwtwqncnyd.supabase.co/auth/v1/callback`

---

## Summary

| Component | Web (pixel-perfect-replicator-x) | React Native (mello-android) |
|-----------|----------------------------------|------------------------------|
| Auth Provider | `supabase.auth.signInWithOAuth` | Same + expo-auth-session |
| Storage | localStorage | expo-secure-store |
| Redirect | window.location.origin | makeRedirectUri with scheme |
| Browser | Native redirect | expo-web-browser |
| Callback | Automatic | Manual URL parsing |

---

## Files to Create in Mello Android

1. `lib/supabase.ts` - Supabase client with SecureStore
2. `contexts/AuthContext.tsx` - Auth provider with Google sign-in
3. `app/(auth)/signin.tsx` - Sign-in screen with Google button
4. Update `app.json` - Add URL scheme
5. Update `app/_layout.tsx` - Add deep link handler

---

## Requirements From You (Before Implementation)

### 1. Supabase Dashboard Access/Confirmation
- [ ] **Confirm Google Provider is enabled** in Supabase Authentication > Providers
- [ ] **Confirm redirect URLs** are added to Supabase:
  - `mello://auth/callback` (for production app)
  - `exp://localhost:8081` (for Expo Go development)
  - `exp://192.168.x.x:8081` (for physical device testing)

### 2. Google Cloud Console
- [ ] **Google OAuth Client ID** for Android (`google-services.json` if needed)
- [ ] **Google OAuth Client ID** for iOS
- [ ] **Confirm authorized redirect URIs** include:
  - `https://drepvbrhkxzwtwqncnyd.supabase.co/auth/v1/callback`

### 3. App Configuration Decisions
- [ ] **App URL Scheme**: Is `mello://` acceptable or do you prefer another scheme?
- [ ] **Android Package Name**: Is `com.mello.app` correct?
- [ ] **iOS Bundle Identifier**: Is `com.mello.app` correct?

### 4. Post-Auth Flow Decision
- [ ] After Google sign-in success, where should user go?
  - Option A: New users → Onboarding flow (name-input, etc.)
  - Option B: Existing users → Home screen
  - Option C: Always → Specific screen (which one?)

### 5. Referral Code Integration
- [ ] Do you want referral code support with Google sign-in? (Web app has this)
- [ ] If yes, how should referral codes be passed in mobile app?

### 6. Profile Creation
- [ ] Should a new profile be automatically created on first Google sign-in?
- [ ] What default values should be set for new Google users?

---

## Implementation Checklist (Once Requirements Are Confirmed)

### Phase 1: Setup
- [ ] Install required dependencies
- [ ] Create Supabase client with SecureStore
- [ ] Configure app.json with URL scheme

### Phase 2: Auth Context
- [ ] Create AuthContext with Google sign-in function
- [ ] Implement auth state listener
- [ ] Add profile fetching/creation logic

### Phase 3: UI
- [ ] Add "Continue with Google" button to existing signin screen
- [ ] Style button to match design
- [ ] Handle loading states

### Phase 4: Deep Linking
- [ ] Configure deep link handler in _layout.tsx
- [ ] Handle OAuth callback
- [ ] Test redirect flow

### Phase 5: Testing
- [ ] Test in Expo Go
- [ ] Test on physical Android device
- [ ] Test on physical iOS device (if applicable)
- [ ] Test new user flow
- [ ] Test existing user flow

---

## Questions for Review

1. Is the current Supabase project (`drepvbrhkxzwtwqncnyd`) the same one you want to use for the mobile app?
2. Should the mobile app share the same `profiles` table as the web app?
3. Do you need any additional fields tracked for mobile users (e.g., device type, app version)?
4. Should sign-out on mobile also sign out the web session (or are they independent)?
