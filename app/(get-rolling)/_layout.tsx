/**
 * Get Rolling Flow Layout
 * Interactive reflection phase with smooth cinematic transitions
 */

import { Stack } from 'expo-router';

export default function GetRollingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 600,
        contentStyle: { backgroundColor: 'transparent' },
        gestureEnabled: false, // Disable swipe back for onboarding flow
      }}
    />
  );
}
