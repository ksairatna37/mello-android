# Onboarding Storage Utility

A centralized, database-ready storage system for user onboarding data.

## Location

```
utils/onboardingStorage.ts
```

## Architecture

Uses the **Adapter Pattern** for easy database migration:

```
┌─────────────────────────────────────────┐
│           Public API                     │
│  (getOnboardingData, updateOnboardingData, etc.)
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         StorageAdapter Interface         │
│  - get(): Promise<OnboardingData>        │
│  - set(data): Promise<void>              │
│  - update(updates): Promise<void>        │
│  - clear(): Promise<void>                │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ AsyncStorage  │   │   Supabase    │
│   Adapter     │   │   Adapter     │
│  (Current)    │   │  (Future)     │
└───────────────┘   └───────────────┘
```

## Data Schema

```typescript
interface OnboardingData {
  // Step 3: Name Input
  firstName?: string;
  lastName?: string;

  // Step 4: Profile Picture / Avatar
  avatarType?: 'emoji' | 'icon' | 'image' | null;
  avatarValue?: string | null;

  // Step 5: Feelings Selection
  selectedFeelings?: string[];  // ['anxious', 'stressed', 'lonely', ...]

  // Step 6: Mood Weight
  moodIntensity?: number;  // 0-3 (Calm, Finding rhythm, Carrying a lot, Struggling)

  // Step 7: Terms & Trust
  termsAccepted?: boolean;
  termsAcceptedAt?: string;  // ISO timestamp

  // Step 8: Permissions
  notificationsEnabled?: boolean;
  microphoneEnabled?: boolean;

  // Completion Tracking
  completedSteps?: string[];
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string;  // ISO timestamp

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}
```

## Usage

### Reading Data

```typescript
import { getOnboardingData, getOnboardingField, getAvatar } from '@/utils/onboardingStorage';

// Get all data
const data = await getOnboardingData();
console.log(data.firstName, data.selectedFeelings);

// Get specific field
const firstName = await getOnboardingField('firstName');

// Get avatar
const avatar = await getAvatar();
console.log(avatar.type, avatar.value);
```

### Writing Data

```typescript
import { updateOnboardingData, saveAvatar } from '@/utils/onboardingStorage';

// Update specific fields (merges with existing)
await updateOnboardingData({
  firstName: 'John',
  lastName: 'Doe',
});

// Save avatar (also saves to legacy key for backward compatibility)
await saveAvatar('emoji', '😊');
```

### Completion Tracking

```typescript
import { markStepCompleted, completeOnboarding } from '@/utils/onboardingStorage';

// Mark individual step as completed
await markStepCompleted('profile-picture');

// Mark entire onboarding as complete
await completeOnboarding();
```

### Clearing Data

```typescript
import { clearOnboardingData } from '@/utils/onboardingStorage';

// Clear all onboarding data (for testing/reset)
await clearOnboardingData();
```

## Screens Using This Storage

| Screen | File | Data Saved |
|--------|------|------------|
| Name Input | `name-input.tsx` | `firstName`, `lastName` |
| Profile Picture | `profile-picture.tsx` | `avatarType`, `avatarValue` |
| Feelings Select | `feelings-select.tsx` | `selectedFeelings` |
| Mood Weight | `mood-weight.tsx` | `moodIntensity` |
| Terms & Trust | `terms-trust.tsx` | `termsAccepted`, `termsAcceptedAt` |
| Permissions | `permissions.tsx` | `notificationsEnabled`, `microphoneEnabled`, `onboardingCompleted` |

## Migrating to Supabase

When ready to use a database, follow these steps:

### 1. Create Database Table

```sql
CREATE TABLE user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_type TEXT,
  avatar_value TEXT,
  selected_feelings TEXT[],
  mood_intensity INTEGER,
  terms_accepted BOOLEAN DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,
  notifications_enabled BOOLEAN DEFAULT FALSE,
  microphone_enabled BOOLEAN DEFAULT FALSE,
  completed_steps TEXT[],
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own data
CREATE POLICY "Users can manage own onboarding data"
  ON user_onboarding
  FOR ALL
  USING (auth.uid() = user_id);
```

### 2. Uncomment Supabase Adapter

In `utils/onboardingStorage.ts`, uncomment the `SupabaseAdapter` class and update it with your Supabase client.

### 3. Switch Active Adapter

Change from:
```typescript
const adapter: StorageAdapter = new AsyncStorageAdapter();
```

To:
```typescript
const adapter: StorageAdapter = new SupabaseAdapter(userId);
```

### 4. Handle User ID

The Supabase adapter requires a user ID. You'll need to:
- Pass the user ID when initializing the adapter
- Or create a factory function that gets the current user from auth context

Example factory pattern:
```typescript
let cachedAdapter: StorageAdapter | null = null;

async function getAdapter(): Promise<StorageAdapter> {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return new SupabaseAdapter(user.id);
  }

  // Fall back to local storage if not authenticated
  return new AsyncStorageAdapter();
}
```

## Best Practices

1. **Always use `updateOnboardingData`** for partial updates - it merges with existing data
2. **Use `setOnboardingData`** only when you want to replace all data
3. **Check `onboardingCompleted`** before showing onboarding screens
4. **Use timestamps** (`createdAt`, `updatedAt`) for debugging and analytics
5. **Legacy support**: `saveAvatar` also writes to the old `userAvatar` key for backward compatibility

## Testing

To reset onboarding state during development:

```typescript
import { clearOnboardingData } from '@/utils/onboardingStorage';

// In a debug menu or test:
await clearOnboardingData();
```
