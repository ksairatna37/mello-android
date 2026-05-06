---
name: mello-ui
description: Mello's design-system rules for any UI work. Apply when creating or modifying screens, components, buttons, text, backgrounds, cards, or styles. Enforces Outfit font, gradient wrappers, Colors/Spacing/Shadows tokens from constants/, SafeAreaInsets, and Pressable. Use before writing any new RN styles.
---

# Mello UI skill

Use this whenever Claude touches any UI. Goal: keep the app visually coherent ("mental-health safe, breathing room") and aligned with the tokens in `constants/`.

> **Note on upcoming rebrand:** The product is being renamed to **Self Mind** with a new palette (primary `#9B72F5`) and font (**DM Serif Text**). The rename has not been applied yet. Keep using the current tokens below until `constants/colors.ts` and `constants/typography.ts` are updated.

## Source of truth — import from `constants/`

Never hardcode a hex value, spacing pixel, or raw font name if a token exists:

```tsx
import { Colors, Gradients } from '@/constants/colors';
import { Typography, TextStyles, getFontFamily } from '@/constants/typography';
import { Spacing, BorderRadius, Shadows } from '@/constants/spacing';
```

## Color rules

- **Primary purple** — `Colors.light.primary` (`#b9a6ff`). Text on purple should use `Colors.light.primaryForeground` (`#1a1625`).
- **Backgrounds**
  - Screens → `Gradients.melloPrimary` via `<MelloGradient />` at the top of the tree.
  - Chat / voice → `Gradients.melloChat` or `melloOrb` for the animated orb background.
  - Solid tints OK for cards: `Colors.light.surface` (`#ffffff`), `Colors.light.accent` (`#edeafa`).
- **Dark mode** — currently defined in `Colors.dark` but the app is light-first. Don't assume dark mode works until verified.
- **Onboarding-new uses a slightly different accent `#8B7EF8` + bg `#F2F0FF`** — if you're working inside `app/(onboarding-new)/`, match that local convention; do NOT silently migrate one to match the other.

## Typography rules

RN ignores `fontWeight` for custom fonts — you must set `fontFamily` directly.

```tsx
// ✅ Good
<Text style={{ fontFamily: 'Outfit-SemiBold', fontSize: 17 }}>Hello</Text>

// ✅ Also fine — use the helper
<Text style={{ fontFamily: getFontFamily('600'), fontSize: 17 }}>Hello</Text>

// ❌ Wrong — fontWeight alone won't load the semibold file
<Text style={{ fontFamily: 'Outfit', fontWeight: '600' }}>Hello</Text>
```

Available weights: `Outfit-Thin | ExtraLight | Light | Regular | Medium | SemiBold | Bold | ExtraBold | Black`.

Pre-built styles to prefer: `TextStyles.h1 | h2 | h3 | body | bodySmall | caption | button`.

Accent fonts (do not use for body copy):
- `DMSerifDisplay-Regular` — for the "Mello" logo / formal headings
- `PlaywriteHRLijeva` — decorative brand script

## Spacing rules

- Screen horizontal padding: `Spacing.screenHorizontal` (20px)
- Screen vertical padding: combine `useSafeAreaInsets()` + spacing tokens
- Gaps between stacked elements: `Spacing.md` (16px) or `Spacing.lg` (24px) — the app leans generous
- Button padding: `Spacing.buttonPadding` (24h / 14v)
- Card padding: `Spacing.cardPadding` (20px)

## Shadows & elevation

```tsx
import { Shadows } from '@/constants/spacing';
<View style={[styles.card, Shadows.md]} />
```

- Use `Shadows.sm | md | lg` — they already include Android `elevation`
- On a brand-purple button, add a colored shadow too:
  ```tsx
  { shadowColor: '#8B7EF8', shadowOffset: {width:0,height:8}, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 }
  ```

## Radius

- Buttons: `BorderRadius.full` (pill) — this is the app's signature
- Cards: `BorderRadius.lg` (16) or `xl` (24)
- Inputs: `BorderRadius.lg` (16) with a 1.5px border; focus state bumps border to `#8B7EF8`

## Interaction patterns

- **Always `Pressable`**, never `TouchableOpacity`. Add `hitSlop={8}` to icon-only buttons.
- **Disabled state** — drop opacity to `0.45`, remove shadow. Don't use a separate grey color.
- **Keyboard** — text-entry screens: `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.

## Screen scaffold (use this for every new screen)

```tsx
import { View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MelloGradient from '@/components/common/MelloGradient';

export default function MyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <MelloGradient />
      <View style={[styles.inner, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        {/* content */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0FF' },
  inner:     { flex: 1, paddingHorizontal: 24 },
});
```

## Edge fades between sections — always use `FadingScrollWrapper`

When content needs a soft fade at the top/bottom of a scrollable area or between vertical sections, do NOT roll your own `MaskedView` + `LinearGradient`. Use the existing component:

```tsx
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';

<FadingScrollWrapper topFadeHeight={50} bottomFadeHeight={80}>
  <ScrollView showsVerticalScrollIndicator={false}>
    {/* sections */}
  </ScrollView>
</FadingScrollWrapper>
```

- Defaults: `topFadeHeight={50}` / `bottomFadeHeight={80}` — tweak per design, keep bottom ≥ top for balance.
- Works on any child content, not only `ScrollView` — can wrap a `View` with vertically stacked sections.
- File name is `ScrollFadeEdges.tsx`, export name is `FadingScrollWrapper` (also default export). Import by name for clarity.

## Animation easing — ease-in-out only

The app's tone is calm and predictable; bouncy motion breaks that feeling.

- ✅ `withTiming(value, { duration, easing: Easing.out(Easing.cubic) })`
- ✅ `withTiming(value, { duration, easing: Easing.inOut(Easing.cubic) })`
- ❌ `withSpring(...)` — never
- ❌ `withDecay(...)` — never
- ❌ `Easing.bounce`, `Easing.elastic(...)` — never
- ❌ `LayoutAnimation.Presets.spring` — never
- Applies to Reanimated, core `Animated`, `LayoutAnimation`, Moti, any CSS-like transition.
- If you see a spring in existing code while editing nearby, flag it — don't silently leave it as precedent.

## Guardrails — things to refuse or call out

- Don't add Tailwind, NativeWind, styled-components, or any new styling lib — we use `StyleSheet.create`.
- Don't hardcode brand colors as hex — pull from `Colors` / `Gradients`.
- Don't import `fontWeight` without also setting the matching `fontFamily` — text will render in the default weight.
- Don't drop the gradient background — every main screen has one.
- Don't skip `useSafeAreaInsets()` — notches and gesture bars will clip content.
- Don't break light-first assumption silently — if adding dark variants, ship both.
- Don't use spring / bounce / elastic physics for animation — see "Animation easing" above.
