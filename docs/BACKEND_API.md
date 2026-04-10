# Mello Backend API — Complete Reference

> **Base URL**: `https://new-mello-backend.thankfuldesert-772ce932.westus.azurecontainerapps.io`
> **Live Docs**: `{BASE_URL}/docs`
> **Last Updated**: 2026-04-07
> **Total Endpoints**: 19

---

## Table of Contents

1. [Architecture](#architecture)
2. [Authentication Endpoints](#authentication-endpoints)
3. [User Onboarding Endpoints](#user-onboarding-endpoints)
4. [Chat Endpoints](#chat-endpoints)
5. [Mood Checkin Endpoints](#mood-checkin-endpoints)
6. [Journal Entry Endpoints](#journal-entry-endpoints)
7. [Profile Endpoints](#profile-endpoints)
8. [App Integration Map](#app-integration-map)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MELLO APP                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    AZURE BACKEND                            │  │
│  │         (new-mello-backend.thankfuldesert...)              │  │
│  │                                                             │  │
│  │  AUTH:          POST /rest/v1/auth/signup                  │  │
│  │                 POST /rest/v1/auth/login                   │  │
│  │                 POST /rest/v1/auth/verify-otp              │  │
│  │                 POST /rest/v1/auth/resend-otp              │  │
│  │                 POST /rest/v1/auth/reset-password          │  │
│  │                 POST /rest/v1/auth/confirm-reset           │  │
│  │                 POST /rest/v1/auth/set-password            │  │
│  │                 DELETE /rest/v1/auth/user                  │  │
│  │                                                             │  │
│  │  ONBOARDING:    POST /rest/v1/user_onboarding              │  │
│  │                                                             │  │
│  │  CHAT:          POST /rest/v1/upload/chat                  │  │
│  │                 POST /rest/v1/load/chat                    │  │
│  │                 POST /rest/v1/update/chat                  │  │
│  │                                                             │  │
│  │  MOOD:          POST /rest/v1/mood_checkins                │  │
│  │                 GET  /rest/v1/mood_checkins                │  │
│  │                                                             │  │
│  │  JOURNAL:       POST /rest/v1/journal_entries              │  │
│  │                 GET  /rest/v1/journal_entries              │  │
│  │                                                             │  │
│  │  PROFILES:      GET  /rest/v1/profiles                     │  │
│  │                 PATCH /rest/v1/profiles                    │  │
│  │                 DELETE /rest/v1/profiles                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              SUPABASE DIRECT (Google OAuth only)            │  │
│  │  • Native Google Sign-In → signInWithIdToken               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication Endpoints

All auth endpoints are **public** (no Bearer token required) unless noted.

### 1. POST /rest/v1/auth/signup

Register a new user with email and password. Creates `auth.users` row and `public.profiles` row via trigger.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | Minimum 6 characters |

**Response (201):**

```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "profile": { /* public.profiles row */ }
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 201 | Created successfully |
| 400 | Invalid input (bad email format, short password) |
| 409 | Email already taken |
| 500 | Auth failure |

---

### 2. POST /rest/v1/auth/login

Authenticate with email and password. Returns session tokens and profile.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |
| `password` | string | Yes | User password |

**Response (200):**

```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "access_token": "eyJhbGc...",
  "refresh_token": "refresh_token_string",
  "profile": { /* public.profiles row */ }
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Missing fields |
| 401 | Invalid credentials |
| 403 | Email not verified |
| 500 | Auth error |

---

### 3. POST /rest/v1/auth/verify-otp

Verify 6-digit OTP sent to email during signup. Activates account.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |
| `otp` | string | Yes | 6-digit code (e.g., "482910") |

**Response (200):**

```json
{
  "message": "Email verified successfully",
  "code": "success",
  "user_id": "uuid",
  "email": "user@example.com",
  "profile": { /* public.profiles row */ }
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Verified |
| 400 | Invalid or expired OTP |
| 500 | Auth error |

---

### 4. POST /rest/v1/auth/resend-otp

Resend signup OTP to email when original expires or wasn't received.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |

**Response (200):**

```json
{
  "message": "OTP resent successfully",
  "code": "success"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Sent |
| 400 | Missing email |
| 500 | Auth error |

---

### 5. POST /rest/v1/auth/reset-password

Step 1 of password reset. Sends 6-digit OTP to email.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |

**Response (200):**

```json
{
  "message": "Password reset OTP sent",
  "code": "success"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Sent |
| 400 | Missing email |
| 500 | Auth error |

---

### 6. POST /rest/v1/auth/confirm-reset

Step 2 of password reset. Verify OTP and set new password.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |
| `otp` | string | Yes | 6-digit code |
| `new_password` | string | Yes | Minimum 6 characters |

**Response (200):**

```json
{
  "message": "Password reset successful",
  "code": "success",
  "user_id": "uuid"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Reset successful |
| 400 | Invalid or expired OTP |
| 500 | Auth error |

---

### 7. POST /rest/v1/auth/set-password

Set password for OAuth/passwordless users who don't have one yet.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Conditional | Required if `user_id` not provided |
| `user_id` | uuid | Conditional | Required if `email` not provided |
| `new_password` | string | Yes | Minimum 6 characters |

**Response (200):**

```json
{
  "message": "Password set successfully",
  "code": "success",
  "user_id": "uuid"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Set successfully |
| 400 | Invalid fields |
| 404 | User not found |
| 409 | Password already set |
| 500 | Auth error |

---

### 8. DELETE /rest/v1/auth/user

Permanently delete user from `auth.users`. Cascades to `public.profiles`.

**Auth Required:** Yes (`SUPABASE_SERVICE_ROLE_KEY`)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | uuid | Conditional | Required if `email` not provided |
| `email` | string | Conditional | Required if `user_id` not provided |

**Response (200):**

```json
{
  "message": "User deleted",
  "code": "success",
  "user_id": "uuid"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Deleted |
| 400 | Invalid identifier |
| 403 | Protected user |
| 404 | Not found |
| 500 | Server error |

---

## User Onboarding Endpoints

### 9. POST /rest/v1/user_onboarding

Save complete onboarding payload (upserts to `user_onboarding` table).

**Auth Required:** Yes (`Bearer <access_token>`)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | uuid | Yes | Auth user ID |
| `first_name` | string | Yes | Non-empty |
| `terms_accepted` | boolean | Yes | If true, requires `terms_accepted_at` |
| `onboarding_completed` | boolean | Yes | If true, requires `onboarding_completed_at` |
| `last_name` | string | No | |
| `avatar_type` | string | No | `"emoji"`, `"icon"`, or `"image"` |
| `avatar_value` | string | No | Emoji char, icon name, or image URI |
| `selected_feelings` | string[] | No | e.g., `["anxious", "stressed"]` |
| `mood_intensity` | integer\|null | No | 0-3 scale |
| `notifications_enabled` | boolean | No | |
| `microphone_enabled` | boolean | No | |
| `age_range` | string | No | e.g., `"18-24"`, `"25-34"` |
| `avatar_reason` | string | No | Why they picked avatar |
| `discomfort_reasons` | string[] | No | What's weighing on them |
| `style` | string | No | Communication style preference |
| `challenge` | string | No | Current challenge |
| `presence` | string | No | Presence preference |
| `insight` | string | No | Insight preference |
| `terms_accepted_at` | ISO 8601 | Conditional | Required if `terms_accepted=true` |
| `onboarding_completed_at` | ISO 8601 | Conditional | Required if `onboarding_completed=true` |

**Response (201):**

Returns the upserted row.

**Status Codes:**

| Code | Description |
|------|-------------|
| 201 | Created/Updated |
| 400 | Validation error or invalid user FK |
| 500 | Database error |

---

## Chat Endpoints

### 10. POST /rest/v1/upload/chat

Upload chat messages for user.

**Auth Required:** Yes (`Bearer <access_token>`)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | uuid | Yes | User ID |
| `chat` | object | Yes | Contains messages array |

**Status Codes:** 400, 500

---

### 11. POST /rest/v1/load/chat

Load chat payload for user.

**Auth Required:** Yes (`Bearer <access_token>`)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | uuid | Yes | User ID |

**Response (200):**

Returns chat JSON object.

**Status Codes:** 200, 400, 500

---

### 12. POST /rest/v1/update/chat

Update chat payload for user.

**Auth Required:** Yes (`Bearer <access_token>`)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | uuid | Yes | User ID |
| `chat` | object | Yes | New chat payload |

**Response (200):**

Returns updated row.

**Status Codes:** 200, 400, 500

---

## Mood Checkin Endpoints

### 13. POST /rest/v1/mood_checkins

Create or update mood JSON for user.

**Auth Required:** Yes (`Bearer <access_token>`)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | uuid | Yes | Must be valid UUID |
| `mood` | JSON | Yes | Any JSON value |

**Response (200):**

Returns updated `user_onboarding` row.

**Status Codes:** 200, 400, 404, 500

---

### 14. GET /rest/v1/mood_checkins

Retrieve mood JSON for user.

**Auth Required:** Yes (`Bearer <access_token>`)

**Query Parameters:**

| Param | Format | Example |
|-------|--------|---------|
| `user_id` | `user_id=eq.<uuid>` | `user_id=eq.abc123-...` |

**Response (200):**

Returns mood JSON value.

**Status Codes:** 200, 400, 404, 500

---

## Journal Entry Endpoints

### 15. POST /rest/v1/journal_entries

Create or update journal JSON for user.

**Auth Required:** Yes (`Bearer <access_token>`)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | uuid | Yes | Must be valid UUID |
| `journal` | JSON | Yes | Any JSON value |

**Response (200):**

Returns updated `user_onboarding` row.

**Status Codes:** 200, 400, 404, 500

---

### 16. GET /rest/v1/journal_entries

Retrieve journal JSON for user.

**Auth Required:** Yes (`Bearer <access_token>`)

**Query Parameters:**

| Param | Format | Example |
|-------|--------|---------|
| `user_id` | `user_id=eq.<uuid>` | `user_id=eq.abc123-...` |

**Response (200):**

Returns journal JSON value.

**Status Codes:** 200, 400, 404, 500

---

## Profile Endpoints

### 17. GET /rest/v1/profiles

Fetch full profile row from `public.profiles` by UUID.

**Auth Required:** Yes (`Bearer <access_token>`)

**Query Parameters:**

| Param | Format | Example |
|-------|--------|---------|
| `id` | Plain or `eq.<uuid>` | `id=abc123-...` or `id=eq.abc123-...` |

**Response (200) Schema:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, references auth.users(id) |
| `username` | text | nullable |
| `avatar_url` | text | nullable |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | auto-set on PATCH |
| `referral_code` | text | unique, nullable |
| `referd_by` | uuid | nullable |
| `email_id` | text | unique, nullable |
| `first_login` | boolean | nullable |
| `mello_user_preferences` | json | nullable |
| `referral_count` | integer | default 0 |
| `twitter_connected` | boolean | nullable |
| `twitter_data` | json | nullable |
| `duration` | smallint | default 0 |
| `usage` | json | nullable |
| `login_detail` | json | nullable |
| `base_wallet` | text | nullable |
| `wallet_verified` | boolean | nullable |
| `wallet_address` | text | unique (deferred), nullable |
| `wallet_chain` | text | nullable |
| `wallet_connected` | boolean | default false |
| `wallet_points_received` | boolean | default false |
| `internal_access` | boolean | nullable |

**Status Codes:** 200, 400, 404, 500

---

### 18. PATCH /rest/v1/profiles

Update writable profile fields. `id` and `created_at` are immutable. `updated_at` auto-set.

**Auth Required:** Yes (`Bearer <access_token>`)

**Query Parameters:**

| Param | Format |
|-------|--------|
| `id` | Profile UUID |

**Request Body:**

Any writable columns from GET schema (excluding `id`, `created_at`, `updated_at`).

**Response (200):**

Returns full updated profiles row.

**Status Codes:** 200, 400, 404, 500

---

### 19. DELETE /rest/v1/profiles

Delete profile row from `public.profiles`.

**Auth Required:** Yes (`Bearer <access_token>` or service-role key)

**Query Parameters:**

| Param | Format |
|-------|--------|
| `id` | Profile UUID (plain or `eq.<uuid>`) |

**Response (200):**

```json
{
  "id": "uuid",
  "deleted": true
}
```

**Status Codes:** 200, 400, 404, 500

---

## App Integration Map

### Auth Flow (Email/Password)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Signup    │────▶│  Verify OTP │────▶│   Login     │
│  /signup    │     │ /verify-otp │     │   /login    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        access_token
                                        refresh_token
```

### Auth Flow (Google OAuth)

```
┌─────────────────────┐     ┌─────────────────────┐
│  Google Sign-In     │────▶│  Supabase           │
│  (Native Popup)     │     │  signInWithIdToken  │
└─────────────────────┘     └─────────────────────┘
                                     │
                                     ▼
                              Supabase Session
                              (access_token)
```

### Data Flow: App → Backend

| App Screen | Route | Data Collected | Backend Field |
|------------|-------|----------------|---------------|
| Name Input | `(onboarding-new)/name` | First/last name | `first_name`, `last_name` |
| Avatar | `(onboarding-new)/avatar` | Avatar selection | `avatar_type`, `avatar_value` |
| Feelings | `(onboarding-new)/feelings` | Multi-select emotions | `selected_feelings` |
| Mood Weight | `(onboarding-new)/mood-weight` | Intensity slider | `mood_intensity` |
| Terms | `(onboarding-new)/terms` | Acceptance + timestamp | `terms_accepted`, `terms_accepted_at` |
| Permissions | `(onboarding-new)/permissions` | Notification/mic perms | `notifications_enabled`, `microphone_enabled` |
| Age | `(get-rolling)/age` | Age range selection | `age_range` |
| Avatar Analysis | `(get-rolling)/avatar-analysis` | Why they chose avatar | `avatar_reason` |
| Discomfort | `(get-rolling)/discomfort` | What's weighing on them | `discomfort_reasons` |
| Style | `(get-rolling)/style` | Communication style | `style` |
| Challenge | `(get-rolling)/challenges` | Current challenge | `challenge` |
| Presence | `(get-rolling)/presence` | Presence preference | `presence` |
| Insight | `(get-rolling)/insight` | Insight preference | `insight` |

### Field Mapping (App → Backend)

| App Field (camelCase) | Backend Field (snake_case) |
|----------------------|---------------------------|
| `firstName` | `first_name` |
| `lastName` | `last_name` |
| `avatarType` | `avatar_type` |
| `avatarValue` | `avatar_value` |
| `selectedFeelings` | `selected_feelings` |
| `moodIntensity` | `mood_intensity` |
| `termsAccepted` | `terms_accepted` |
| `termsAcceptedAt` | `terms_accepted_at` |
| `notificationsEnabled` | `notifications_enabled` |
| `microphoneEnabled` | `microphone_enabled` |
| `ageRange` | `age_range` |
| `avatarReason` | `avatar_reason` |
| `discomfortReasons` | `discomfort_reasons` |
| `style` | `style` |
| `challenge` | `challenge` |
| `presence` | `presence` |
| `insight` | `insight` |
| `onboardingCompleted` | `onboarding_completed` |
| `onboardingCompletedAt` | `onboarding_completed_at` |

---

## Endpoint Summary Table

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 1 | POST | `/rest/v1/auth/signup` | No | Register new user |
| 2 | POST | `/rest/v1/auth/login` | No | Login, get tokens |
| 3 | POST | `/rest/v1/auth/verify-otp` | No | Verify email OTP |
| 4 | POST | `/rest/v1/auth/resend-otp` | No | Resend OTP |
| 5 | POST | `/rest/v1/auth/reset-password` | No | Request password reset |
| 6 | POST | `/rest/v1/auth/confirm-reset` | No | Confirm reset with OTP |
| 7 | POST | `/rest/v1/auth/set-password` | No | Set password (OAuth users) |
| 8 | DELETE | `/rest/v1/auth/user` | Service Key | Delete user |
| 9 | POST | `/rest/v1/user_onboarding` | Bearer | Save onboarding data |
| 10 | POST | `/rest/v1/upload/chat` | Bearer | Upload chat |
| 11 | POST | `/rest/v1/load/chat` | Bearer | Load chat |
| 12 | POST | `/rest/v1/update/chat` | Bearer | Update chat |
| 13 | POST | `/rest/v1/mood_checkins` | Bearer | Save mood |
| 14 | GET | `/rest/v1/mood_checkins` | Bearer | Get mood |
| 15 | POST | `/rest/v1/journal_entries` | Bearer | Save journal |
| 16 | GET | `/rest/v1/journal_entries` | Bearer | Get journal |
| 17 | GET | `/rest/v1/profiles` | Bearer | Get profile |
| 18 | PATCH | `/rest/v1/profiles` | Bearer | Update profile |
| 19 | DELETE | `/rest/v1/profiles` | Bearer | Delete profile |

---

*Generated by SID CTO System | 2026-04-07*
  