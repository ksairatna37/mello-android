/**
 * Onboarding flow — Stack navigator for the full active route chain.
 *
 * Order (matches the live route chain in the app):
 *   welcome → credibility → personalize-intro → name-input → questions
 *   → analysing → your-reading → save-profile → verify-email → permissions
 *   → welcome-aboard → /(main)/home
 *
 * /welcome-aboard finalizes onboarding inline (calls completeOnboarding
 * on its CTAs). RouterGate routes the now-authed-complete user to /chat
 * once the profile flag flips.
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        // Cream container so transitions never reveal the dark activity window.
        contentStyle: { backgroundColor: '#FBF5EE' },
        // CRITICAL for the iOS-style back transition.
        //
        // Default for `router.replace` is the PUSH animation
        // (slide-in-from-right) — same as a forward push. That makes
        // back navigation feel "wrong direction" because back-handlers
        // here use `router.replace(parent)` (the only safe pattern given
        // RouterGate.replace can land users mid-flow with no real back
        // stack). Setting this to 'pop' tells RN-screens to animate the
        // replace as a POP (slide-out-to-right, new screen slides in
        // from left) — the natural back motion.
        //
        // Forward replaces (questions → analysing, etc.) have been
        // migrated to `router.push` so they aren't affected by this.
        animationTypeForReplace: 'pop',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="credibility" />
      <Stack.Screen name="personalize-intro" />
      <Stack.Screen name="name-input" />
      <Stack.Screen
        name="questions"
        options={{
          // The questions screen owns its OWN back behavior — a horizontal
          // pager whose hardware-back handler scrolls to the previous
          // question (Q9 → Q8 → … → Q1, then router.replace to /name-input).
          // Leaving the OS swipe-back gesture enabled would let an iOS
          // edge-swipe pop the entire /questions screen straight to
          // /name-input, skipping every question the user just answered.
          // Disable it so all back paths funnel through the pager.
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="analysing" />
      <Stack.Screen name="your-reading" />
      <Stack.Screen name="save-profile" />
      <Stack.Screen
        name="verify-email"
        options={{
          // verify-email is always entered as a forward step — RouterGate
          // replaces save-profile with it when state becomes pendingOtp.
          // The global animationTypeForReplace:'pop' would make it slide
          // in from the left (back direction). Override to 'push' so it
          // slides in from the right, matching every other forward step.
          animationTypeForReplace: 'push',
        }}
      />
      <Stack.Screen
        name="permissions"
        options={{
          // /permissions is always entered as a forward step — replaced
          // in from save-profile (Google auth) or verify-email (OTP
          // success). Same override reason as verify-email above.
          // gestureEnabled: false prevents iOS swipe-back past this
          // decision screen; hardware back is also blocked inside the
          // screen via BackHandler.
          animationTypeForReplace: 'push',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="welcome-aboard" />
    </Stack>
  );
}
