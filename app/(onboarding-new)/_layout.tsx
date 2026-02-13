/**
 * New Onboarding Flow Layout
 * Stack navigator for the new onboarding screens
 *
 * Emotionally-Aware UX Flow:
 * 1. verify-email - Trust building (authentication)
 * 2. disclaimer - Safety & transparency
 * 3. name-input - Identity (who you are)
 * 4. profile-picture - Visual identity (how you present yourself)
 * 5. feelings-select - Emotional awareness (how you feel)
 * 6. mood-weight - Calibration (personalization)
 * 7. terms-trust - Trust handoff (consent as clarity)
 * 8. permissions - Final step (gentle permission requests)
 * 9. personalizing - Loading/transition to main app
 */

import { Stack } from 'expo-router';

export default function OnboardingNewLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="disclaimer" />
      <Stack.Screen name="name-input" />
      <Stack.Screen name="profile-picture" />
      <Stack.Screen name="feelings-select" />
      <Stack.Screen name="mood-weight" />
      <Stack.Screen name="terms-trust" />
      <Stack.Screen name="permissions" />
      <Stack.Screen
        name="personalizing"
        options={{
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
