# Mello Onboarding Storage System

A centralized, database-ready storage system for capturing and persisting user onboarding data.

---

## Table of Contents

1. [Overview](#overview)
2. [Storage Location](#storage-location)
3. [Onboarding Flow](#onboarding-flow)
4. [Data Structure](#data-structure)
5. [Architecture](#architecture)
6. [API Reference](#api-reference)
7. [Screen Integration](#screen-integration)
8. [Database Migration Guide](#database-migration-guide)
9. [Best Practices](#best-practices)

---

## Overview

The onboarding storage utility (`utils/onboardingStorage.ts`) provides:

- **Centralized data management** for all onboarding screens
- **Database-ready architecture** using the Adapter Pattern
- **Automatic timestamps** for tracking and analytics
- **Legacy compatibility** with existing avatar storage
- **Type-safe API** with full TypeScript support

---

## Storage Location

### Current: AsyncStorage (Local Device)

Data is stored locally on the user's device using React Native's AsyncStorage.

**Storage Path (Android):**
```
/data/data/com.mello.android/files/AsyncStorage/
├── onboardingData     # Main onboarding data (JSON)
└── userAvatar         # Legacy avatar key (backward compatibility)
```

**Storage Path (iOS):**
```
~/Library/Application Support/com.mello.android/
├── RCTAsyncLocalStorage/
│   ├── onboardingData
│   └── userAvatar
```

**Storage Key:** `onboardingData`

**Data Format:** JSON string

---

## Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     MELLO ONBOARDING FLOW                        │
└─────────────────────────────────────────────────────────────────┘

Step 1: Welcome Screen
    │   (No data saved)
    ▼
Step 2: Disclaimer
    │   (No data saved)
    ▼
Step 3: Name Input ──────────────────► Saves: firstName, lastName
    │
    ▼
Step 4: Profile Picture ─────────────► Saves: avatarType, avatarValue
    │
    ▼
Step 5: Feelings Selection ──────────► Saves: selectedFeelings[]
    │
    ▼
Step 6: Mood Weight ─────────────────► Saves: moodIntensity
    │   (Crisis check if "Struggling")
    ▼
Step 7: Terms & Trust ───────────────► Saves: termsAccepted, termsAcceptedAt
    │
    ▼
Step 8: Permissions ─────────────────► Saves: notificationsEnabled, microphoneEnabled
    │                                         onboardingCompleted, onboardingCompletedAt
    ▼
Step 9: Personalizing
    │   (Loading screen - no data saved)
    ▼
    ┌──────────────────┐
    │   ONBOARDING     │
    │   COMPLETE       │
    └──────────────────┘
```

---

## Data Structure

### OnboardingData Interface

```typescript
interface OnboardingData {
  // ═══════════════════════════════════════════════════════════════
  // STEP 3: NAME INPUT
  // ═══════════════════════════════════════════════════════════════
  firstName?: string;              // User's first name
  lastName?: string;               // User's last name

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: PROFILE PICTURE / AVATAR
  // ═══════════════════════════════════════════════════════════════
  avatarType?: 'emoji' | 'icon' | 'image' | null;
  avatarValue?: string | null;     // Emoji char, icon name, or image URI

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: FEELINGS SELECTION (Multi-select)
  // ═══════════════════════════════════════════════════════════════
  selectedFeelings?: string[];     // Array of feeling IDs

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: MOOD WEIGHT
  // ═══════════════════════════════════════════════════════════════
  moodIntensity?: number;          // 0-3 scale

  // ═══════════════════════════════════════════════════════════════
  // STEP 7: TERMS & TRUST
  // ═══════════════════════════════════════════════════════════════
  termsAccepted?: boolean;
  termsAcceptedAt?: string;        // ISO 8601 timestamp

  // ═══════════════════════════════════════════════════════════════
  // STEP 8: PERMISSIONS
  // ═══════════════════════════════════════════════════════════════
  notificationsEnabled?: boolean;
  microphoneEnabled?: boolean;

  // ═══════════════════════════════════════════════════════════════
  // COMPLETION TRACKING
  // ═══════════════════════════════════════════════════════════════
  completedSteps?: string[];       // ['name-input', 'profile-picture', ...]
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string;  // ISO 8601 timestamp

  // ═══════════════════════════════════════════════════════════════
  // AUTOMATIC TIMESTAMPS
  // ═══════════════════════════════════════════════════════════════
  createdAt?: string;              // First data write
  updatedAt?: string;              // Last data write
}
```

### Field Details

#### Avatar Types

| Type | Value Example | Description |
|------|---------------|-------------|
| `emoji` | `"😊"` | Single emoji character |
| `icon` | `"heart-outline"` | Ionicons icon name |
| `image` | `"file:///data/.../photo.jpg"` | Local file URI |

#### Feelings Options

| ID | Label |
|----|-------|
| `anxious` | Feeling anxious or worried |
| `stressed` | Stressed or overwhelmed |
| `lonely` | Lonely or disconnected |
| `burnout` | Burnt out from work or life |
| `relationship` | Relationship issues |
| `sleep` | Trouble sleeping |
| `talk` | Just want someone to talk to |
| `exploring` | Exploring mental wellness |
| `other` | Feeling something else |

#### Mood Intensity Scale

| Value | Label | Description |
|-------|-------|-------------|
| `0` | Calm | Feeling at peace |
| `1` | Finding my rhythm | Managing okay |
| `2` | Carrying a lot | Feeling burdened |
| `3` | Struggling | Needs support (triggers crisis check) |

---

## Architecture

### Adapter Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                        PUBLIC API                                │
│  ┌───────────────┐  ┌────────────────────┐  ┌───────────────┐  │
│  │ getOnboarding │  │ updateOnboarding   │  │   getAvatar   │  │
│  │    Data()     │  │      Data()        │  │      ()       │  │
│  └───────────────┘  └────────────────────┘  └───────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    STORAGE ADAPTER INTERFACE                     │
│                                                                  │
│   interface StorageAdapter {                                     │
│     get(): Promise<OnboardingData>;                             │
│     set(data: OnboardingData): Promise<void>;                   │
│     update(updates: Partial<OnboardingData>): Promise<void>;    │
│     clear(): Promise<void>;                                     │
│   }                                                              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
┌─────────────────────┐  ┌────────────────┐  ┌────────────────┐
│   AsyncStorage      │  │   Supabase     │  │   Firebase     │
│     Adapter         │  │    Adapter     │  │    Adapter     │
│   ✓ ACTIVE          │  │   (Future)     │  │   (Future)     │
└─────────────────────┘  └────────────────┘  └────────────────┘
```

---

## API Reference

### Reading Data

```typescript
import {
  getOnboardingData,
  getOnboardingField,
  getAvatar
} from '@/utils/onboardingStorage';

// Get all onboarding data
const data = await getOnboardingData();
// Returns: OnboardingData object

// Get specific field
const firstName = await getOnboardingField('firstName');
// Returns: string | undefined

// Get avatar data
const avatar = await getAvatar();
// Returns: { type: string | null, value: string | null }
```

### Writing Data

```typescript
import {
  updateOnboardingData,
  setOnboardingData,
  saveAvatar
} from '@/utils/onboardingStorage';

// Update specific fields (RECOMMENDED - merges with existing)
await updateOnboardingData({
  firstName: 'John',
  lastName: 'Doe',
});

// Replace all data (use with caution)
await setOnboardingData({
  firstName: 'John',
  onboardingCompleted: true,
});

// Save avatar (includes legacy key support)
await saveAvatar('emoji', '😊');
```

### Tracking Progress

```typescript
import {
  markStepCompleted,
  completeOnboarding
} from '@/utils/onboardingStorage';

// Mark individual step complete
await markStepCompleted('profile-picture');

// Mark entire onboarding complete
await completeOnboarding();
// Sets: onboardingCompleted = true, onboardingCompletedAt = timestamp
```

### Clearing Data

```typescript
import { clearOnboardingData } from '@/utils/onboardingStorage';

// Clear all onboarding data (for testing/reset)
await clearOnboardingData();
```

---

## Screen Integration

### File Locations

| Step | Screen File | Data Saved |
|------|-------------|------------|
| 3 | `app/(onboarding-new)/name-input.tsx` | `firstName`, `lastName` |
| 4 | `app/(onboarding-new)/profile-picture.tsx` | `avatarType`, `avatarValue` |
| 5 | `app/(onboarding-new)/feelings-select.tsx` | `selectedFeelings` |
| 6 | `app/(onboarding-new)/mood-weight.tsx` | `moodIntensity` |
| 7 | `app/(onboarding-new)/terms-trust.tsx` | `termsAccepted`, `termsAcceptedAt` |
| 8 | `app/(onboarding-new)/permissions.tsx` | `notificationsEnabled`, `microphoneEnabled`, `onboardingCompleted` |

### Integration Pattern

```typescript
// In any onboarding screen:

import { updateOnboardingData } from '@/utils/onboardingStorage';

const handleContinue = async () => {
  // 1. Save data before navigating
  await updateOnboardingData({
    fieldName: fieldValue,
  });

  // 2. Navigate to next screen
  router.push('/(onboarding-new)/next-screen');
};
```

---

## Database Migration Guide

### Step 1: Create Supabase Table

```sql
-- Create onboarding table
CREATE TABLE user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Name
  first_name TEXT,
  last_name TEXT,

  -- Avatar
  avatar_type TEXT CHECK (avatar_type IN ('emoji', 'icon', 'image')),
  avatar_value TEXT,

  -- Feelings
  selected_feelings TEXT[],

  -- Mood
  mood_intensity INTEGER CHECK (mood_intensity BETWEEN 0 AND 3),

  -- Terms
  terms_accepted BOOLEAN DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,

  -- Permissions
  notifications_enabled BOOLEAN DEFAULT FALSE,
  microphone_enabled BOOLEAN DEFAULT FALSE,

  -- Completion
  completed_steps TEXT[],
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users manage own onboarding"
  ON user_onboarding FOR ALL
  USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE TRIGGER update_onboarding_timestamp
  BEFORE UPDATE ON user_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Step 2: Uncomment Supabase Adapter

In `utils/onboardingStorage.ts`, uncomment the `SupabaseAdapter` class.

### Step 3: Switch Active Adapter

```typescript
// Change from:
const adapter: StorageAdapter = new AsyncStorageAdapter();

// To:
const adapter: StorageAdapter = new SupabaseAdapter(userId);
```

### Step 4: Handle Authentication

```typescript
// Create a factory function:
async function getStorageAdapter(): Promise<StorageAdapter> {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return new SupabaseAdapter(user.id);
  }

  // Fallback to local for unauthenticated users
  return new AsyncStorageAdapter();
}
```

---

## Best Practices

### DO ✅

- Use `updateOnboardingData()` for partial updates (it merges)
- Save data BEFORE navigating to next screen
- Check `onboardingCompleted` before showing onboarding
- Use TypeScript for type-safe field access
- Handle errors gracefully (functions won't throw)

### DON'T ❌

- Don't use `setOnboardingData()` unless replacing ALL data
- Don't access AsyncStorage directly - use the API
- Don't forget to call `completeOnboarding()` at the end
- Don't store sensitive data (passwords, tokens) here

### Testing & Debugging

```typescript
// In a debug menu or test:
import { getOnboardingData, clearOnboardingData } from '@/utils/onboardingStorage';

// View current data
const data = await getOnboardingData();
console.log('Onboarding Data:', JSON.stringify(data, null, 2));

// Reset for testing
await clearOnboardingData();
```

---

## Related Files

- **Utility:** `utils/onboardingStorage.ts`
- **Types:** Defined in `utils/onboardingStorage.ts`
- **Screens:** `app/(onboarding-new)/*.tsx`
- **Get Rolling Integration:** `app/(get-rolling)/avatar-analysis.tsx`

---

*Last Updated: February 2026*
