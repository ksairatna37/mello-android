# Mello App Vibe Coding Context

Last updated from codebase audit: 2026-04-10
Repo audited: `d:\mello-android`
Platform target: mobile only, iOS + Android via Expo / React Native

## 1. Executive Summary

Mello is a mobile-first emotional wellness companion app with:

- hybrid authentication:
  - email/password + OTP via a custom REST backend
  - Google Sign-In via native Google SDK + Supabase Auth
- a two-phase onboarding:
  - structured onboarding screens
  - a softer conversational "Get Rolling" flow
- multiple support surfaces:
  - home dashboard
  - text chat
  - voice chat in English using Hume AI EVI over WebSocket
  - voice chat in Hindi using LiveKit + an external Sarvam/Pipecat-style agent
  - breathing exercise
  - journal
  - mood tracking/history
  - crisis support surfaces

Important reality check: the app is part production, part prototype, part design shell. Some areas are fully wired, some are local-only, and some are placeholder/demo implementations. If a vibe coding team is rebuilding this "in one go", they should treat this document as the source-of-truth audit of current behavior, not the older docs alone.

## 2. Tech Stack

### Frontend

- Expo SDK `54`
- React `19.1.0`
- React Native `0.81.5`
- Expo Router for file-based routing
- Reanimated + Gesture Handler for motion-heavy UI
- `expo-linear-gradient`, `expo-blur`, `lottie-react-native` for visuals
- AsyncStorage for local persistence

### Auth / Data / Realtime

- Supabase JS client for:
  - Google auth session handling
  - `profiles` table reads/writes
- Custom REST backend for:
  - email/password auth
  - OTP verification
  - reset-password
  - onboarding sync
- Hume AI EVI for English voice
- LiveKit for Hindi voice rooms

### Native / Device Integrations

- custom Expo native module at `modules/audio`
- Google Sign-In native SDK
- Expo AV microphone permissions
- Expo Notifications permission request
- image picker for journal photos
- speech recognition package installed

## 3. App Structure

### Routing groups

- `app/_layout.tsx`
  - root providers, fonts, splash, deep link handling
- `app/index.tsx`
  - decides initial redirect
- `app/(onboarding)`
  - legacy marketing/welcome/tour flow
- `app/(auth)`
  - standalone auth screens
- `app/(onboarding-new)`
  - main structured onboarding flow
- `app/(get-rolling)`
  - reflective conversational onboarding continuation
- `app/(main)`
  - post-onboarding app

### Main routes

| Route | Purpose | Status |
|---|---|---|
| `/(onboarding)/welcome` | marketing welcome screen | active |
| `/(auth)/signin` | standalone sign-in | active |
| `/(auth)/signup` | standalone sign-up | partially outdated |
| `/(onboarding-new)/verify-email` | OTP verification after email signup | active |
| `/(onboarding-new)/name-input` | onboarding start after auth | active |
| `/(onboarding-new)/profile-picture` | avatar selection | active |
| `/(onboarding-new)/feelings-select` | primary emotional reasons | active |
| `/(onboarding-new)/mood-weight` | emotional intensity slider | active |
| `/(onboarding-new)/terms-trust` | trust/terms | active |
| `/(onboarding-new)/permissions` | notifications + mic | active |
| `/(onboarding-new)/personalizing` | animated transition into Get Rolling | active |
| `/(get-rolling)/age` | age range | active |
| `/(get-rolling)/avatar-analysis` | why avatar was chosen | active |
| `/(get-rolling)/discomfort` | discomfort reasons | active |
| `/(get-rolling)/style` | preferred interaction style | active |
| `/(get-rolling)/challenges` | current challenge | active |
| `/(get-rolling)/presence` | desired emotional presence | active |
| `/(get-rolling)/insight` | final insight + backend sync + enter app | active |
| `/(main)/home` | dashboard | active |
| `/(main)/chat` | text chat | demo/local behavior |
| `/(main)/call` | voice chat | real integration |
| `/(main)/journal` | journal | local-only |
| `/(main)/mood` | mood UI | mostly design shell |
| `/(main)/mood-history` | mood history | local-only |
| `/(main)/settings` | settings/legal/signout | active |
| `/change-password` | change password by OTP | active |

## 4. What Is Connected vs What Is Placeholder

### Fully or mostly connected

- Google Sign-In -> native Google -> Supabase Auth
- email signup/login/reset -> custom REST backend
- profile lookup/update -> Supabase `profiles`
- onboarding local persistence -> AsyncStorage
- onboarding backend sync -> custom REST backend, but only when email auth provides stored access token
- English voice -> Hume WebSocket + custom native audio module
- Hindi voice -> LiveKit token endpoint + LiveKit room connection

### Local-only

- journal entries
- mood history/check-ins
- streaks
- home page most card data
- avatar cache from onboarding storage

### Demo / placeholder / incomplete

- text chat is simulated responses, not real LLM backend
- `app/(auth)/signup.tsx` still contains TODO-era logic and bypasses real email signup flow
- profile screen is placeholder UI with fake values
- settings "Delete Account" is only an alert; no deletion call
- some docs describe backend ownership differently than the code
- `DEV_SKIP_TO_GET_ROLLING` in `app/index.tsx` is currently `true`, which forces redirect into main route during development

## 5. Critical Findings

These are the most important facts for a rebuild team.

### 5.1 Source-of-truth drift exists

The repo has conflicting backend documentation:

- `docs/BACKEND_API.md` says Azure backend base URL:
  - `https://new-mello-backend.thankfuldesert-772ce932.westus.azurecontainerapps.io`
- actual runtime code in `api/endpoints.ts` uses:
  - `https://me-539b4e0a005d4010ba48937cc598b48a.ecs.ap-south-2.on.aws`

For rebuild purposes: trust the code first, docs second.

### 5.2 Auth is hybrid, not unified

There are two auth systems in one app:

- Google auth:
  - native Google SDK
  - Supabase auth session
  - profile lookup by Supabase user `id`
- email auth:
  - custom backend login/signup/OTP
  - tokens stored manually in AsyncStorage
  - profile lookup by `email_id`

This means the app is not using one single auth abstraction end-to-end.

### 5.3 Onboarding completion is split between local and backend

- onboarding screens save locally in AsyncStorage
- profile `first_login` in Supabase decides whether the user is considered onboarded
- backend sync happens at the end of Get Rolling
- local onboarding is marked complete earlier, on the permissions screen

This split can create edge cases if the app closes before final sync.

### 5.4 Backend onboarding sync currently depends on email-auth tokens

`services/onboarding/onboardingApi.ts` fetches:

- `accessToken` from `services/auth/authStorage.ts`
- `userId` from stored email session

Google users authenticated purely through Supabase do not automatically populate this same storage shape, so the custom backend sync path is effectively aligned with email-auth users, not all users.

### 5.5 Text chat is not production AI today

`components/chat/ChatScreen.tsx`:

- sends user message locally
- runs crisis keyword detection locally
- replies with random canned empathetic responses after timeout

There is no real chat model call in this screen.

### 5.6 Voice is the most real AI product surface

English voice:

- mic audio from native module
- direct WebSocket to Hume EVI
- assistant audio returned from Hume
- intervention guidance injected dynamically

Hindi voice:

- app requests LiveKit token from a webapp endpoint
- joins LiveKit room
- external Hindi agent joins room and exchanges transcript/data packets

## 6. Environment Variables, Keys, Secrets, IDs

This repo contains live-looking keys and IDs in plain text. These should be treated as sensitive and rotated before sharing outside trusted internal teams.

### `.env`

Current contents:

```env
EXPO_PUBLIC_HUME_API_KEY=lNacYQhyNIzEPdIgUb6KkgSUex1VUkYjKnPQkYA3jExLudOg
EXPO_PUBLIC_HUME_CONFIG_ID=3cdbbe91-bbf6-4e38-93b2-6166b113498a
EXPO_PUBLIC_LIVEKIT_API_URL=https://mello-demo-drcjf8ahgvgphee3.southindia-01.azurewebsites.net/api/livekit-token
```

### Hardcoded Supabase configuration

From `lib/supabase.ts`:

```txt
SUPABASE_URL=https://drepvbrhkxzwtwqncnyd.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZXB2YnJoa3h6d3R3cW5jbnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjkzOTczMjQsImV4cCI6MjA0NDk3MzMyNH0.OJCaAJBAxZfrydgUfm1A_ECFL3uCOmYX33rjCETcNQw
```

### Hardcoded Google OAuth client IDs

From `contexts/AuthContext.tsx`:

```txt
GOOGLE_WEB_CLIENT_ID=499732705533-9lmeh4ah0rvbb6f6dirtudmf6gts7avb.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=499732705533-ot31akqnmvgvona2a89j2dbhfle7a2om.apps.googleusercontent.com
```

### App identifiers / scheme

From `app.json`:

```txt
scheme=mello
ios.bundleIdentifier=health.melloai.app
android.package=health.melloai.app
expo.extra.eas.projectId=841494e5-4e32-47f3-a891-9373d197e851
```

### iOS URL scheme for Google

From `app.json`:

```txt
com.googleusercontent.apps.499732705533-ot31akqnmvgvona2a89j2dbhfle7a2om
```

## 7. Backend, APIs, Endpoints

### Primary custom REST backend used by runtime code

Base URL:

```txt
https://me-539b4e0a005d4010ba48937cc598b48a.ecs.ap-south-2.on.aws
```

### Endpoint map from `api/endpoints.ts`

#### Auth

- `POST /rest/v1/auth/signup`
- `POST /rest/v1/auth/login`
- `POST /rest/v1/auth/verify-otp`
- `POST /rest/v1/auth/resend-otp`
- `POST /rest/v1/auth/reset-password`
- `POST /rest/v1/auth/confirm-reset`
- `POST /rest/v1/auth/set-password`
- `DELETE /rest/v1/auth/user`

#### Onboarding

- `POST /rest/v1/user_onboarding`

#### Chat

- `POST /rest/v1/upload/chat`
- `POST /rest/v1/load/chat`
- `POST /rest/v1/update/chat`

#### Mood

- `POST /rest/v1/mood_checkins`
- `GET /rest/v1/mood_checkins`

#### Journal

- `POST /rest/v1/journal_entries`
- `GET /rest/v1/journal_entries`

#### Profiles

- `GET /rest/v1/profiles`
- `PATCH /rest/v1/profiles`
- `DELETE /rest/v1/profiles`

### Supabase direct access

Supabase is used directly from client code for:

- auth session handling for Google users
- `profiles` table reads/writes
- auth state listener
- querying by:
  - `id`
  - `email_id`

### LiveKit token endpoint

From env:

```txt
POST https://mello-demo-drcjf8ahgvgphee3.southindia-01.azurewebsites.net/api/livekit-token
```

Request body shape:

```json
{
  "language": "hi-IN",
  "userId": "user-<timestamp> or supplied value",
  "userName": "User or supplied value"
}
```

Expected response shape:

```json
{
  "success": true,
  "token": "...",
  "livekitUrl": "...",
  "roomName": "...",
  "language": "hi-IN"
}
```

### Hume endpoint

English voice connects directly to:

```txt
wss://api.hume.ai/v0/evi/chat?config_id=<CONFIG_ID>&api_key=<API_KEY>
```

## 8. Authentication Architecture

### Mode A: Email/password auth

System:

- custom REST backend handles signup/login/OTP/reset
- app manually stores email-auth session in AsyncStorage

Flow:

1. user signs up with email + password
2. backend creates account
3. OTP verification screen collects 6-digit code
4. on success, app tries auto-login to get access + refresh tokens
5. app stores:
   - email
   - provider=`email`
   - userId
   - accessToken
   - refreshToken
6. app routes user into onboarding

Storage:

- AsyncStorage key: `@mello_auth_session`

Important note:

- email-auth users are not using Supabase auth session as the primary session
- they still depend on Supabase `profiles` table for profile status checks

### Mode B: Google Sign-In

System:

- `@react-native-google-signin/google-signin`
- Supabase `signInWithIdToken`

Flow:

1. app opens native Google Sign-In
2. receives Google `idToken`
3. passes token to `supabase.auth.signInWithIdToken`
4. auth state listener fires `SIGNED_IN`
5. app fetches or upserts profile in Supabase
6. app checks `profiles.first_login`
7. routes to onboarding or main app

Special iOS behavior:

- generates SHA256 nonce
- passes hashed nonce to Google
- passes raw nonce to Supabase

### Auth post-login routing logic

Implemented in `contexts/AuthContext.tsx`:

- status `-1`:
  - no profile found
  - upsert profile
  - go to `/(onboarding-new)/name-input`
- status `0`:
  - profile exists, `first_login=false`
  - go to onboarding
- status `1`:
  - profile exists, `first_login=true`
  - go to main route

Default main route currently:

```txt
/(main)/chat
```

### Password reset / change

Supported flow:

- request OTP with current email
- verify OTP
- submit new password

### Delete account

Current app behavior:

- not implemented
- settings screen only shows a confirmation alert and logs to console

## 9. Session and Storage

### Auth session storage

`services/auth/authStorage.ts`

AsyncStorage keys:

- `@mello_auth_session`
- `@mello_auth_email` exists in constants but is not meaningfully used

Stored session shape:

```json
{
  "email": "user@example.com",
  "userId": "uuid",
  "provider": "email | google",
  "accessToken": "...",
  "refreshToken": "...",
  "loginStatus": true,
  "timestamp": 1710000000000
}
```

### Onboarding storage

`utils/onboardingStorage.ts`

Primary AsyncStorage key:

- `onboardingData`

Legacy compatibility key:

- `userAvatar`

Captured fields:

- `firstName`
- `lastName`
- `avatarType`
- `avatarValue`
- `selectedFeelings`
- `moodIntensity`
- `termsAccepted`
- `termsAcceptedAt`
- `email`
- `emailVerified`
- `notificationsEnabled`
- `microphoneEnabled`
- `ageRange`
- `avatarReason`
- `discomfortReasons`
- `style`
- `challenge`
- `presence`
- `insight`
- `completedSteps`
- `currentStep`
- `onboardingCompleted`
- `onboardingCompletedAt`
- `createdAt`
- `updatedAt`

### Mood / journal storage

`utils/melloStorage.ts`

Keys:

- `@mello/journal_entries`
- `@mello/mood_checkins`
- `@mello/checkin_streak`

What is stored locally:

- journal entries
- mood check-ins
- daily streak
- mood score history for charts

## 10. Onboarding Flow

### Structured onboarding flow

1. `verify-email`
   - only for email signup path
2. `disclaimer`
3. `name-input`
4. `profile-picture`
5. `feelings-select`
6. `mood-weight`
7. `terms-trust`
8. `permissions`
9. `personalizing`
10. `get-rolling/*`

### Field-by-field mapping

| App field | Backend field | Source step |
|---|---|---|
| `firstName` | `first_name` | `name-input` |
| `lastName` | `last_name` | `name-input` |
| `avatarType` | `avatar_type` | `profile-picture` |
| `avatarValue` | `avatar_value` | `profile-picture` |
| `selectedFeelings` | `selected_feelings` | `feelings-select` |
| `moodIntensity` | `mood_intensity` | `mood-weight` |
| `termsAccepted` | `terms_accepted` | `terms-trust` |
| `termsAcceptedAt` | `terms_accepted_at` | `terms-trust` |
| `notificationsEnabled` | `notifications_enabled` | `permissions` |
| `microphoneEnabled` | `microphone_enabled` | `permissions` |
| `ageRange` | `age_range` | `get-rolling/age` |
| `avatarReason` | `avatar_reason` | `get-rolling/avatar-analysis` |
| `discomfortReasons` | `discomfort_reasons` | `get-rolling/discomfort` |
| `style` | `style` | `get-rolling/style` |
| `challenge` | `challenge` | `get-rolling/challenges` |
| `presence` | `presence` | `get-rolling/presence` |
| `insight` | `insight` | `get-rolling/insight` |
| `onboardingCompleted` | `onboarding_completed` | `permissions` and final sync |
| `onboardingCompletedAt` | `onboarding_completed_at` | `permissions` and final sync |

### Navigation/resume model

The app stores `currentStep` continuously. On app launch:

- if authenticated and not fully onboarded:
  - resume from `currentStep` if present
  - otherwise start at `/(onboarding-new)/name-input`

### Finalization logic

At end of `get-rolling/insight`:

- clear `currentStep`
- call `syncOnboardingToBackend()`
- route to main app

Separately, `AuthContext.completeOnboarding()` sets `profiles.first_login = true`.

## 11. Main App Experience

### Home

Home is the emotional dashboard and uses a sticky header with `mello` branding and the user's avatar from onboarding storage.

Sections:

- My Vibes
- Positive Notes
- Mood Tides
- Gentle Support

Home data sources:

- first name from onboarding storage
- avatar from onboarding storage
- streak and mood check-ins from local `melloStorage`
- affirmations are hardcoded rotational content

### Journal

Journal supports:

- list view
- new entry composer
- emotion tagging
- optional photo
- speech-to-text button
- writing prompts
- post-save CTA to "Talk to Mello"

Persistence:

- local-only via AsyncStorage

### Mood

There are two mood-related experiences:

- `/(main)/mood`
  - heavily visual mood picker UI
  - currently more of a designed screen than a data-integrated tracker
- `/(main)/mood-history`
  - reads actual local mood check-in history

### Settings

Settings supports:

- current email display
- change password
- privacy policy link
- terms link
- crisis resources modal
- sign out
- delete-account placeholder

## 12. Voice and AI Systems

### English voice call

Main file:

- `components/voice/VoiceAgentScreen.tsx`

Pipeline:

1. custom native audio module captures mic PCM
2. app sends base64 PCM chunks to Hume EVI over WebSocket
3. Hume returns:
   - user transcript
   - prosody/emotion scores
   - assistant text
   - assistant audio
4. assistant audio is enqueued into native playback
5. transcript UI can be shown/hidden

Features:

- mute/unmute
- transcript toggle
- fullscreen toggle
- intervention detection
- crisis warning banner
- speaking/listening indicators
- demo mode exists but is disabled by default

Current environment use:

- `EXPO_PUBLIC_HUME_API_KEY`
- `EXPO_PUBLIC_HUME_CONFIG_ID`

### Intervention engine

File:

- `utils/interventions.ts`

Detected categories:

- `suicidal_tendencies`
- `crisis`
- `breathing`
- `work_exhaustion`
- `loneliness`
- `trauma`
- `emotional_processing`

Behavior:

- parses Hume transcript + emotion scores
- picks highest-priority matching intervention
- injects `intervention_guidance` back into Hume session settings
- auto-clears after TTL

This is one of the most distinctive product behaviors in the repo.

### Crisis detection

File:

- `utils/crisisDetection.ts`

Current implementation:

- local keyword matching on phrases like:
  - `suicide`
  - `kill myself`
  - `want to die`
  - `harm myself`
- default crisis action currently opens:
  - `tel:988`

Important mismatch:

- `GentleSupportPage` uses India helplines
- `crisisDetection.ts` uses US crisis contacts

A rebuild should unify geography and policy intentionally.

### Hindi voice call

Main files:

- `components/voice/HindiVoiceScreen.tsx`
- `utils/livekitService.ts`

Pipeline:

1. request LiveKit token from configured API
2. connect to LiveKit room
3. enable local mic
4. external Hindi agent joins the room
5. transcript and state updates arrive over data packets

Expected data packet types:

- `user-transcription`
- `bot-transcription`
- `bot-tts-started`
- `bot-tts-stopped`
- `user-started-speaking`
- `user-stopped-speaking`

### Native audio module

Files:

- `modules/audio/src/AudioModule.ts`
- `modules/audio/android/src/main/java/expo/modules/audio/AudioModule.kt`
- `modules/audio/ios/AudioModule.swift`

JS API:

- `getPermissions()`
- `startRecording()`
- `stopRecording()`
- `enqueueAudio(base64EncodedAudio)`
- `stopPlayback()`
- `mute()`
- `unmute()`
- `getMicrophoneMode()`

Events:

- `onAudioInput`
- `onError`
- `onPlaybackComplete`

Purpose:

- low-level real-time audio loop for Hume voice chat
- avoids relying entirely on Expo AV for bidirectional streaming

## 13. Text Chat

Main file:

- `components/chat/ChatScreen.tsx`

Current behavior:

- initializes with a welcome message
- user types text
- crisis keywords trigger local modal
- assistant replies are chosen from a small hardcoded response array
- no backend message persistence is currently wired in this screen

Conclusion:

- visually representative
- not yet a true AI chat feature

## 14. Design System and Visual Language

### Core design personality

The app is designed as:

- soft
- emotionally safe
- airy
- curved
- high-whitespace
- gradient-rich
- less clinical, more companion-like

### Typography

Primary fonts:

- `Outfit`
  - all weights loaded
- `PlaywriteHRLijeva`
  - used for the handwritten `mello` logotype

Typography direction:

- big warm headings
- rounded modern sans for body copy
- handwritten brand accent for logo moments only

### Color system

There are effectively two palettes in use.

#### Brand constants palette

From `constants/colors.ts`:

- mint: `#7FFFD4`
- green: `#98FB98`
- lime: `#ADFF2F`
- yellow: `#F0E68C`
- purple: `#b9a6ff`
- pink: `#e4c1f9`
- light background: `#f8f7ff`

#### Actual UI light theme palette used heavily

From `components/common/LightGradient.tsx`:

- background: `#f5f4fa`
- surface: `#ffffff`
- textPrimary: `#1a1625`
- textSecondary: `#6b6b7b`
- textMuted: `#9999a8`
- border: `#e8e6f0`
- accent: `#b9a6ff`
- accentLight: `#e8e0ff`

Mood card accent colors:

- great: `#F5DEB3`
- good: `#FFCC80`
- okay: `#CE93D8`
- low: `#80CBC4`
- rough: `#F48FB1`

### Gradients

Important background systems:

- `DreamyGradient`
  - welcome / magical onboarding screens
- `LightGradient`
  - soft clean light screens
- `MelloGradient`
  - blob-based animated voice/chat background
- `AuroraGradient`
  - cinematic Get Rolling and breathing screens

### Layout rules

Common patterns:

- large rounded cards
- large pill buttons
- screen padding around `20-24`
- generous vertical spacing
- content cards over gradient backgrounds
- hidden routes used as secondary drill-down surfaces under main tabs

### Motion direction

Motion is meaningful and emotionally paced:

- fade + slide reveals
- soft spring bottom sheets
- typewriter/word-by-word message reveals
- animated background crossfades
- breathing circle as guided somatic UI

## 15. Permissions

Declared in `app.json` and runtime:

### Android

- `RECORD_AUDIO`
- `MODIFY_AUDIO_SETTINGS`
- `POST_NOTIFICATIONS`

### iOS usage descriptions

- microphone
- speech recognition

Runtime asks:

- notifications via `expo-notifications`
- microphone via `expo-av`
- photo library via `expo-image-picker`

## 16. Data Flow

### Auth + onboarding flow

1. unauthenticated user lands on welcome
2. auth happens via:
   - email/password backend
   - or Google native + Supabase
3. app checks profile state in Supabase
4. user enters onboarding
5. onboarding data is saved locally each step
6. permissions step marks onboarding complete locally
7. personalizing leads into Get Rolling
8. Get Rolling adds richer preferences
9. final insight screen syncs data to backend
10. app enters main experience

### Home data flow

- reads onboarding storage for identity
- reads local mood/journal stats
- does not currently depend on remote APIs for most visible content

### Voice data flow

English:

- mic -> native module -> WebSocket -> Hume -> audio back -> native playback

Hindi:

- app -> LiveKit token endpoint -> LiveKit room -> external Hindi agent

### Chat data flow

- entirely local/demo today

### Journal/mood data flow

- AsyncStorage only

## 17. Known Gaps and Rebuild Recommendations

### Functional gaps

- unify auth into one clear architecture
- decide whether all users should have a custom backend token, Supabase token, or both
- make onboarding sync work for Google users too
- replace text chat demo with real AI backend
- wire journal and mood to backend for cross-device sync
- implement real delete-account flow
- unify crisis geography and escalation policy

### Code/documentation gaps

- update docs to match actual backend base URL
- remove obsolete placeholder auth screens or rewire them
- remove dev flags like `DEV_SKIP_TO_GET_ROLLING` before production rebuild

### Product modeling recommendations for vibe coders

- preserve the dual nature of Mello:
  - soft companion aesthetic
  - serious crisis-aware escalation
- preserve the two-stage onboarding:
  - structured data capture
  - emotionally warmer conversational continuation
- keep voice as a first-class feature, not an add-on
- keep local resilience:
  - onboarding resume
  - graceful offline/local journaling

## 18. Build Brief for a Vibe Coding Team

If you are recreating Mello in one pass, the intended product is:

- a mobile-only emotional wellness companion app
- beautiful, soft, premium, non-clinical UI
- hybrid auth with Google and email/OTP
- rich onboarding that feels caring, not corporate
- main experience centered around:
  - home reflection dashboard
  - voice-first AI companion
  - optional text chat
  - breathing, journaling, mood tracking
  - crisis support pathways
- animated, high-touch interactions throughout
- strong personalization from onboarding inputs

And the most important engineering truth is:

- the app should be rebuilt as a coherent system, not as a literal copy of every current implementation detail
- the current codebase contains the right product direction, but not a perfectly unified architecture

## 19. Suggested Rebuild Targets

For a clean rebuild, I would recommend the team target:

- one auth/session model
- one source of truth for backend ownership
- one canonical profile/onboarding schema
- one crisis policy by geography
- one real chat backend
- one sync strategy for journal + mood
- keep the current visual language, animations, and emotional tone

## 20. Audit Sources Used

Primary files inspected during this audit:

- `package.json`
- `app.json`
- `.env`
- `lib/supabase.ts`
- `api/client.ts`
- `api/endpoints.ts`
- `contexts/AuthContext.tsx`
- `services/auth/*`
- `services/onboarding/*`
- `utils/onboardingStorage.ts`
- `utils/melloStorage.ts`
- `utils/humeService.ts`
- `utils/livekitService.ts`
- `utils/crisisDetection.ts`
- `utils/interventions.ts`
- `components/voice/VoiceAgentScreen.tsx`
- `components/voice/HindiVoiceScreen.tsx`
- `components/chat/ChatScreen.tsx`
- `components/home/HomeScreen.tsx`
- `components/journal/*`
- `components/mood/*`
- `app/(onboarding-new)/*`
- `app/(get-rolling)/*`
- `app/(main)/*`
- `modules/audio/*`

