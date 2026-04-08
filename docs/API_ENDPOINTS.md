# Mello API Endpoints Documentation

> **Version**: 1.1.0
> **Last Updated**: 2026-03-21

---

## API Routing Guide

Mello uses **three** API backends. Know which one to call:

| Backend | Base URL | Used For |
|---------|----------|----------|
| **Azure Backend** | `https://new-mello-backend.thankfuldesert-772ce932.westus.azurecontainerapps.io` | Onboarding, Get Rolling, Chat, Mood, Journal |
| **Supabase Direct** | `https://drepvbrhkxzwtwqncnyd.supabase.co` | Auth, Profiles, Settings, Delete Account |
| **External Services** | `wss://api.hume.ai`, LiveKit | Voice/Text Chat (WebSocket) |

> **See also**: [`docs/BACKEND_API.md`](./BACKEND_API.md) — Detailed Azure backend endpoint docs (request/response schemas, field mapping, gap analysis)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Onboarding Endpoints](#onboarding-endpoints)
4. [Profile Endpoints](#profile-endpoints)
5. [Mood & Journal Endpoints](#mood--journal-endpoints)
6. [Settings Endpoints](#settings-endpoints)
7. [Voice & Text Chat](#voice--text-chat)
8. [Latency Optimization Guidelines](#latency-optimization-guidelines)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         MELLO APP                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │    AUTH      │   │  ONBOARDING  │   │   VOICE/TEXT CHAT    │ │
│  │  (Supabase)  │   │  (Supabase)  │   │   (Direct WebSocket) │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘ │
│         │                  │                       │             │
│         ▼                  ▼                       ▼             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    SUPABASE BACKEND                          ││
│  │  • PostgreSQL (profiles, onboarding, mood, journal)         ││
│  │  • Auth (Google OAuth, JWT tokens)                          ││
│  │  • Edge Functions (custom logic)                            ││
│  │  • RLS (Row Level Security)                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  EXTERNAL SERVICES                           ││
│  │  • Hume AI EVI (wss://api.hume.ai) - Voice Agent            ││
│  │  • LiveKit (WebRTC) - Real-time Audio                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication Endpoints

> **Note**: Auth is handled by Supabase Auth SDK. No custom API endpoints needed.

### Current Implementation

The app uses **Supabase Auth** with the following methods:

| Method | Description | Latency Impact |
|--------|-------------|----------------|
| `signInWithIdToken` | Google Sign-In → Supabase | ~200-400ms |
| `signOut` | Clear session | ~50-100ms |
| `getSession` | Check current session | ~10-50ms (cached) |
| `onAuthStateChange` | Listen for auth changes | Real-time |

### Supabase Auth Flow

```typescript
// 1. Google Sign-In (Native SDK)
const { idToken } = await GoogleSignin.signIn();

// 2. Exchange token with Supabase
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'google',
  token: idToken,
});

// 3. Auto-creates profile via Supabase trigger
// Trigger: on_auth_user_created → INSERT INTO profiles
```

### Required Database Trigger

```sql
-- AUTO-CREATE PROFILE ON SIGN UP
-- This trigger fires when a new user signs up via Supabase Auth

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email_id, first_login, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    false,  -- Will become true after onboarding
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Onboarding Endpoints

### Design Decision: Single Batch Endpoint vs Multiple Endpoints

| Approach | Pros | Cons |
|----------|------|------|
| **Single Batch** | 1 network call, atomicity, minimal latency | Larger payload, all-or-nothing |
| **Multiple Steps** | Granular saves, partial progress | 8+ network calls, higher latency |

**RECOMMENDATION**: Use **Single Batch Endpoint** for minimal latency.

---

### `POST /rest/v1/user_onboarding` (Supabase Table)

> **Purpose**: Save all onboarding data in ONE request after completion.
> **When**: Called on final onboarding screen (after permissions step).

#### Request

```http
POST /rest/v1/user_onboarding
Authorization: Bearer <jwt_token>
Content-Type: application/json
apikey: <supabase_anon_key>
Prefer: return=minimal
```

```json
{
  "user_id": "uuid-from-auth",
  "first_name": "string",
  "last_name": "string | null",
  "avatar_type": "emoji | icon | image | null",
  "avatar_value": "string | null",
  "selected_feelings": ["anxious", "stressed", "lonely"],
  "mood_intensity": 2,
  "terms_accepted": true,
  "terms_accepted_at": "2026-03-19T10:30:00Z",
  "notifications_enabled": true,
  "microphone_enabled": true,
  "age_range": "25-34",
  "avatar_reason": "string | null",
  "discomfort_reasons": ["work", "relationships"],
  "onboarding_completed": true,
  "onboarding_completed_at": "2026-03-19T10:35:00Z"
}
```

#### Response

```json
// 201 Created (with Prefer: return=representation)
{
  "id": "uuid",
  "user_id": "uuid",
  "first_name": "Sarah",
  "created_at": "2026-03-19T10:35:00Z",
  "updated_at": "2026-03-19T10:35:00Z"
}

// 204 No Content (with Prefer: return=minimal) - RECOMMENDED for latency
```

#### Error Responses

| Code | Reason |
|------|--------|
| 401 | Missing or invalid JWT |
| 409 | Onboarding already exists for user |
| 422 | Validation error (missing required fields) |

---

### Database Schema: `user_onboarding`

```sql
CREATE TABLE public.user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Name (Step 3)
  first_name TEXT NOT NULL,
  last_name TEXT,

  -- Avatar (Step 4)
  avatar_type TEXT CHECK (avatar_type IN ('emoji', 'icon', 'image')),
  avatar_value TEXT,

  -- Feelings (Step 5) - stored as JSON array
  selected_feelings JSONB DEFAULT '[]'::jsonb,

  -- Mood Intensity (Step 6) - 0=calm, 1=finding rhythm, 2=carrying a lot, 3=struggling
  mood_intensity SMALLINT DEFAULT 0 CHECK (mood_intensity >= 0 AND mood_intensity <= 3),

  -- Terms (Step 7)
  terms_accepted BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,

  -- Permissions (Step 9)
  notifications_enabled BOOLEAN DEFAULT false,
  microphone_enabled BOOLEAN DEFAULT false,

  -- Get Rolling Flow
  age_range TEXT CHECK (age_range IN ('under-18', '18-24', '25-34', '35-44', '45-54', '55+')),
  avatar_reason TEXT,
  discomfort_reasons JSONB DEFAULT '[]'::jsonb,

  -- Completion tracking
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy: Users can only access their own data
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding"
  ON public.user_onboarding FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding"
  ON public.user_onboarding FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding"
  ON public.user_onboarding FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_user_onboarding_user_id ON public.user_onboarding(user_id);
```

---

### Mark Onboarding Complete (Profile Update)

After onboarding is saved, update the `profiles` table:

```http
PATCH /rest/v1/profiles?id=eq.<user_id>
Authorization: Bearer <jwt_token>
Content-Type: application/json
apikey: <supabase_anon_key>
```

```json
{
  "first_login": true,
  "username": "Sarah",
  "updated_at": "2026-03-19T10:35:00Z"
}
```

---

## Profile Endpoints

### `GET /rest/v1/profiles?id=eq.<user_id>`

> **Purpose**: Fetch user profile for display in Profile screen.

#### Request

```http
GET /rest/v1/profiles?id=eq.<user_id>&select=*
Authorization: Bearer <jwt_token>
apikey: <supabase_anon_key>
```

#### Response

```json
[
  {
    "id": "uuid",
    "username": "Sarah",
    "avatar_url": "https://...",
    "email_id": "sarah@example.com",
    "first_login": true,
    "created_at": "2026-03-19T10:00:00Z",
    "updated_at": "2026-03-19T10:35:00Z"
  }
]
```

---

### `PATCH /rest/v1/profiles?id=eq.<user_id>`

> **Purpose**: Update profile (username, avatar).

#### Request

```http
PATCH /rest/v1/profiles?id=eq.<user_id>
Authorization: Bearer <jwt_token>
Content-Type: application/json
apikey: <supabase_anon_key>
```

```json
{
  "username": "NewName",
  "avatar_url": "https://storage.supabase.co/...",
  "updated_at": "2026-03-19T12:00:00Z"
}
```

---

### `DELETE /rest/v1/profiles?id=eq.<user_id>` + Auth Deletion

> **Purpose**: Delete account (GDPR compliant).
> **IMPORTANT**: Must also delete from `auth.users` via Edge Function.

#### Supabase Edge Function: `delete-account`

```typescript
// supabase/functions/delete-account/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get user from JWT
  const authHeader = req.headers.get('Authorization')!
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Delete user (cascades to profiles, onboarding, etc.)
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
```

#### Request

```http
POST /functions/v1/delete-account
Authorization: Bearer <jwt_token>
```

---

## Mood & Journal Endpoints

> **Current State**: Data stored in AsyncStorage (local).
> **Recommended**: Migrate to Supabase for cross-device sync.

### Database Schema: `mood_checkins`

```sql
CREATE TABLE public.mood_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_id TEXT NOT NULL,  -- 'great', 'good', 'okay', 'low', 'rough'
  mood_label TEXT NOT NULL,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique check-in per day per user
  UNIQUE(user_id, check_in_date)
);

-- RLS
ALTER TABLE public.mood_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own mood_checkins"
  ON public.mood_checkins FOR ALL
  USING (auth.uid() = user_id);

-- Index for date range queries
CREATE INDEX idx_mood_checkins_user_date
  ON public.mood_checkins(user_id, check_in_date DESC);
```

### `POST /rest/v1/mood_checkins` (Upsert)

```http
POST /rest/v1/mood_checkins
Authorization: Bearer <jwt_token>
Content-Type: application/json
apikey: <supabase_anon_key>
Prefer: resolution=merge-duplicates
```

```json
{
  "user_id": "uuid",
  "mood_id": "good",
  "mood_label": "Good",
  "check_in_date": "2026-03-19"
}
```

### `GET /rest/v1/mood_checkins?user_id=eq.<user_id>`

```http
GET /rest/v1/mood_checkins?user_id=eq.<user_id>&order=check_in_date.desc&limit=30
Authorization: Bearer <jwt_token>
apikey: <supabase_anon_key>
```

---

### Database Schema: `journal_entries`

```sql
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  emotion TEXT,
  emotion_emoji TEXT,
  photo_url TEXT,
  prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own journal_entries"
  ON public.journal_entries FOR ALL
  USING (auth.uid() = user_id);

-- Index for chronological listing
CREATE INDEX idx_journal_entries_user_created
  ON public.journal_entries(user_id, created_at DESC);
```

### `POST /rest/v1/journal_entries`

```http
POST /rest/v1/journal_entries
Authorization: Bearer <jwt_token>
Content-Type: application/json
apikey: <supabase_anon_key>
```

```json
{
  "user_id": "uuid",
  "content": "Today I felt grateful for...",
  "emotion": "grateful",
  "emotion_emoji": "🙏",
  "prompt": "What made you smile today?"
}
```

---

## Settings Endpoints

### User Settings (Optional - Can use local storage)

If cross-device sync is needed:

```sql
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT true,
  daily_reminder_time TIME,
  theme TEXT DEFAULT 'light',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `PATCH /rest/v1/user_settings?user_id=eq.<user_id>`

```http
PATCH /rest/v1/user_settings?user_id=eq.<user_id>
Authorization: Bearer <jwt_token>
Content-Type: application/json
apikey: <supabase_anon_key>
Prefer: return=minimal
```

```json
{
  "notifications_enabled": false,
  "daily_reminder_time": "09:00:00",
  "updated_at": "2026-03-19T12:00:00Z"
}
```

---

## Voice & Text Chat

### **NO BACKEND API ENDPOINTS REQUIRED**

Voice and text chat connect directly to external services:

| Service | Connection | Purpose |
|---------|------------|---------|
| **Hume AI EVI** | `wss://api.hume.ai/v0/evi/chat` | Voice agent (emotion-aware AI) |
| **LiveKit** | Direct WebRTC | Real-time audio streaming |

### Hume EVI WebSocket Protocol

```typescript
// Connection URL
const url = `wss://api.hume.ai/v0/evi/chat?config_id=${CONFIG_ID}&api_key=${API_KEY}`;

// Messages FROM App → Hume
{ "type": "audio_input", "data": "<base64_pcm>" }
{ "type": "session_settings", "audio": { "encoding": "linear16", "sample_rate": 44100, "channels": 1 } }
{ "type": "session_settings", "variables": { "intervention_guidance": "..." } }

// Messages FROM Hume → App
{ "type": "chat_metadata", "chat_id": "..." }
{ "type": "user_message", "message": { "content": "..." }, "models": { "prosody": { "scores": {...} } } }
{ "type": "assistant_message", "message": { "content": "..." } }
{ "type": "audio_output", "data": "<base64_pcm>" }
{ "type": "user_interruption" }
{ "type": "assistant_end" }
{ "type": "error", "message": "..." }
```

### Why No Backend for Chat?

1. **Direct WebSocket** = Lower latency (no middleware)
2. **API keys** stored in `.env` / secure storage
3. **Hume handles** conversation state, emotion analysis
4. **No need to proxy** audio through our servers

---

## Latency Optimization Guidelines

### 1. Batch Requests

```typescript
// ❌ BAD: 8 sequential requests during onboarding
await saveName();
await saveAvatar();
await saveFeelings();
await saveMoodIntensity();
// ... etc

// ✅ GOOD: 1 batch request at the end
await saveAllOnboardingData(collectedData);
```

### 2. Use `Prefer: return=minimal`

```http
// Returns 204 No Content instead of full object
// Saves ~50-100ms on each write
Prefer: return=minimal
```

### 3. Optimistic Updates

```typescript
// Update UI immediately, sync in background
setProfile({ ...profile, username: newName }); // Instant
await supabase.from('profiles').update({ username: newName }); // Background
```

### 4. Connection Pooling

Supabase JS client reuses connections. Don't create new clients per request.

```typescript
// ✅ GOOD: Single client instance
import { supabase } from '@/lib/supabase';

// ❌ BAD: Creating client per request
const client = createClient(url, key); // DON'T DO THIS
```

### 5. Select Only Required Fields

```http
// ❌ BAD: Fetch everything
GET /rest/v1/profiles?id=eq.123

// ✅ GOOD: Fetch only needed fields
GET /rest/v1/profiles?id=eq.123&select=username,avatar_url
```

### 6. Use Indexes

All foreign keys and commonly queried fields should have indexes:

```sql
CREATE INDEX idx_profiles_email ON profiles(email_id);
CREATE INDEX idx_mood_checkins_date ON mood_checkins(user_id, check_in_date);
```

### 7. Latency Targets

| Operation | Target | Max Acceptable |
|-----------|--------|----------------|
| Auth (cached session) | <50ms | 100ms |
| Profile fetch | <100ms | 200ms |
| Onboarding save | <200ms | 500ms |
| Mood check-in | <100ms | 200ms |
| WebSocket connect | <300ms | 500ms |

---

## Quick Reference: All Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/rest/v1/user_onboarding` | Save all onboarding data |
| `GET` | `/rest/v1/user_onboarding?user_id=eq.X` | Get onboarding data |
| `GET` | `/rest/v1/profiles?id=eq.X` | Get profile |
| `PATCH` | `/rest/v1/profiles?id=eq.X` | Update profile |
| `POST` | `/functions/v1/delete-account` | Delete account |
| `POST` | `/rest/v1/mood_checkins` | Create/update mood |
| `GET` | `/rest/v1/mood_checkins?user_id=eq.X` | Get mood history |
| `POST` | `/rest/v1/journal_entries` | Create journal entry |
| `GET` | `/rest/v1/journal_entries?user_id=eq.X` | Get journal entries |
| `PATCH` | `/rest/v1/user_settings?user_id=eq.X` | Update settings |
| N/A | `wss://api.hume.ai/v0/evi/chat` | Voice chat (direct) |

---

## Migration Checklist

- [ ] Create `user_onboarding` table with RLS
- [ ] Create `mood_checkins` table with RLS
- [ ] Create `journal_entries` table with RLS
- [ ] Create `user_settings` table with RLS
- [ ] Add database trigger for profile creation on signup
- [ ] Deploy `delete-account` Edge Function
- [ ] Update app to use Supabase instead of AsyncStorage
- [ ] Test latency targets

---

## Security Notes

1. **RLS Enabled**: All tables use Row Level Security
2. **JWT Required**: All endpoints require valid Supabase JWT
3. **API Keys**: Hume/LiveKit keys stored in `.env`, never committed
4. **GDPR**: Delete account removes all user data (cascade delete)
5. **No PII in Logs**: Never log user content or emotions

---

*Generated by SID CTO System | Last Updated: 2026-03-19*
