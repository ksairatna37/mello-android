---
name: onboarding-screen
description: Create or modify a screen inside app/(onboarding-new)/. Apply when the user is building, editing, or extending the Self Mind / Mello onboarding flow — including question screens, input screens, analysis screens, auth gates, or the post-signup sync screens. Enforces the established onboarding visual language, entrance animations, state persistence via utils/onboardingStorage, and navigation via router.replace(... as any).
---

# Onboarding screen skill

Use this whenever touching `app/(onboarding-new)/`. The onboarding flow has a distinct visual language and state-persistence pattern that MUST be preserved.

## Visual conventions (observed in `name-input.tsx` and siblings)

- **Background**: solid `#F2F0FF` with `<MelloGradient />` overlay
- **Accent color**: `#8B7EF8` (slightly different from `constants/colors.ts` primary — intentional)
- **Title**: `fontFamily: 'Outfit-Bold', fontSize: 34, lineHeight: 40, color: '#1A1A1A'`
- **Subtitle**: `fontFamily: 'Outfit-Regular', fontSize: 15, color: '#9999A8'`
- **Input glass card**: `rgba(255,255,255,0.75)` bg, `borderRadius: 20`, `borderWidth: 1.5`, `borderColor: 'rgba(139,126,248,0.18)'` (bumps to `#8B7EF8` on focus)
- **Primary button**:
  ```ts
  {
    backgroundColor: '#8B7EF8',
    paddingVertical: 18,
    borderRadius: 999,
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  }
  ```
  Disabled state: `opacity: 0.45`, `shadowOpacity: 0`, `elevation: 0`.
- **Header row**: back chevron (Ionicons `chevron-back`, size 24, color `#1A1A1A`), then flex spacer, 40×40 hit target, `hitSlop={8}` on the pressable.
- **Screen padding**: `paddingHorizontal: 24`, `paddingTop: insets.top + 8`, `paddingBottom: insets.bottom + 24`.

## Entrance animation cascade

Every onboarding screen fades its header → content → CTA with staggered delays:

```tsx
const headerAnim = useSharedValue(0);
const inputAnim  = useSharedValue(0);
const btnAnim    = useSharedValue(0);

useEffect(() => {
  const cfg = { duration: 420, easing: Easing.out(Easing.cubic) };
  headerAnim.value = withDelay(60,  withTiming(1, cfg));
  inputAnim.value  = withDelay(180, withTiming(1, cfg));
  btnAnim.value    = withDelay(300, withTiming(1, cfg));
}, []);

const headerStyle = useAnimatedStyle(() => ({
  opacity: headerAnim.value,
  transform: [{ translateY: (1 - headerAnim.value) * 16 }],
}));
```

Translate-Y offsets: header 16, content 14, button 12 (decreasing).

## State persistence — `utils/onboardingStorage.ts`

Every screen:

1. **On mount** — `saveCurrentStep('<screen-name>')` so the user resumes here on return.
2. **Hydrate** from `getOnboardingData()` if the screen has restorable state.
3. **On continue** — `await updateOnboardingData({ field: value })` before navigating.

```tsx
useEffect(() => {
  saveCurrentStep('name-input');
  getOnboardingData().then((data) => { if (data.firstName) setFirstName(data.firstName); });
}, []);

const handleContinue = async () => {
  await updateOnboardingData({ firstName: firstName.trim() });
  router.replace('/(onboarding-new)/questions' as any);
};
```

## Navigation rules

- **Always `router.replace(... as any)`** within the onboarding flow — user can't go back through finished steps with the tab history. The `as any` cast is because expo-router's type generator doesn't always catch up on new routes.
- **Back button** uses `router.canGoBack() ? router.back() : router.replace('<previous>' as any)`.
- **Auth-gated screens** (`save-profile`, `welcome-aboard`) read from `useAuth()` and may redirect if the user is already signed in.

## Auth-provider-aware screens

Some screens behave differently for Google vs email signups. Pattern:

```tsx
const { user, authProvider } = useAuth();

useEffect(() => {
  if (authProvider === 'google' && user) {
    // pre-fill from Google user metadata, then skip to next
    router.replace('/(onboarding-new)/questions' as any);
  }
}, []);

if (authProvider === 'google') return null; // avoid flash during redirect
```

## Keyboard handling

Wrap text-entry content in `KeyboardAvoidingView` + `TouchableWithoutFeedback` for dismissal:

```tsx
<KeyboardAvoidingView
  style={styles.flex}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
>
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View>{/* ... */}</View>
  </TouchableWithoutFeedback>
</KeyboardAvoidingView>
```

Keep the CTA button **outside** the `KeyboardAvoidingView` so it sticks to the bottom regardless of keyboard.

## Guardrails

- Don't swap `#8B7EF8` for the `constants/colors.ts` primary `#b9a6ff` inside onboarding-new — the flow deliberately uses a different accent. Confirm before normalizing.
- Don't call `router.push` inside the flow; always `router.replace`.
- Don't forget `saveCurrentStep()` — resume will break.
- Don't let screens diverge in padding / animation cadence / button style — the flow reads as one emotional journey.
- For a new question, extend the `QUESTIONS` array in `app/(onboarding-new)/_components/types.ts` and reuse `<QuestionPage />` — don't author a new custom question screen unless the design needs it.
