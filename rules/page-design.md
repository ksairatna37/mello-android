# Page design

**Read this BEFORE: creating a new screen, redesigning an existing one, choosing colors / typography, or adding a scrollable view.**

This file is the design-system contract for the SelfMind redesign. Source of truth for the visual language. The full taxonomy lives in `docs/STYLE_GUIDE.md`; this file is the must-not-violate subset for shipping a new page.

---

## 1. Brand feel — the voice and visual

Warm, unhurried, never clinical. The app should feel like talking to the kindest version of yourself — a quiet room, not a product.

- Never clinical terms, diagnoses, or scores.
- Prefer *"notice / tend / sit with"* over *"track / monitor / analyze"*.
- No exclamation marks, no emoji in UI copy.
- First-person friendly: "you" for the user, "we" for SelfMind.

---

## 2. Color tokens — only `BRAND` from `BrandGlyphs.tsx`

```tsx
import { BRAND as C } from '@/components/common/BrandGlyphs';
// C.cream, C.ink, C.coral, C.peach, C.lavender, C.sage, C.butter, ...
```

No hardcoded hex values in screen code. The base background is always `C.cream`. Pure white (`C.paper`) is **for cards only**, always paired with a 1px line border. Tone-colored canvases (peach, lavender, sage, butter, coral) are reserved for question screens / emotional surfaces — see existing screens for the convention.

Full token table in `docs/STYLE_GUIDE.md` § Color tokens.

---

## 3. Typography — pick the right Fraunces optical cut

| Family            | Cut    | Use                          |
|-------------------|--------|------------------------------|
| `Fraunces-XL`     | 144pt  | Wordmarks, 46px+ display     |
| `Fraunces`        | 72pt   | Headlines 20–44px            |
| `Fraunces-Text`   | 9pt    | Body 11–16px                 |
| `Inter-*`         | —      | UI, buttons, legal           |
| `JetBrainsMono-*` | —      | Kickers, mono labels         |

Browsers interpolate the variable axis automatically — native doesn't, so picking the wrong cut for the rendered size makes text look anemic (large 144pt at body sizes) or chunky (9pt at headline sizes).

- **Italic is the emphasis device.** Inline a nested `<Text style={styles.headlineItalic}>...</Text>` with `fontFamily: 'Fraunces-MediumItalic'`.
- **Size scale (mobile):** 10, 11, 13, 15, 16, 18, 24, 32, 44, 64. Pick from the scale.
- **Letter-spacing:** mono kickers `+2.0–2.4`, headlines `0` to `+0.3` (negative tracking clips italic tails on Android), body `+0.15–0.2`.
- **Line heights:** 1.25–1.5×.
- **Android serif headlines ≥ 40px:** set `includeFontPadding: false` or the top edge looks cramped.

---

## 4. Components

### Buttons (pill-shaped, `borderRadius: 999`)

- **Primary** — `backgroundColor: C.ink`, `color: C.cream`, `Inter-Medium` 15px
- **Secondary** — `backgroundColor: C.paper`, `borderWidth: 1, borderColor: C.line2`, `color: C.ink`
- **Ghost** — transparent, no border, `color: C.ink2`

### Cards

- `backgroundColor: C.paper`, `borderRadius: 20–22`, `borderWidth: 1, borderColor: C.line`, `padding: 18`.
- Tone variants (peach/lavender/ink/sage/butter): use the bg color, **drop the border**.

### Kickers (mono uppercase eyebrows)

```tsx
<Text style={styles.kicker}>— before we begin</Text>
```

```ts
kicker: {
  fontFamily: 'JetBrainsMono',
  fontSize: 11,
  letterSpacing: 2.2,
  color: C.ink3,
  textTransform: 'uppercase',
},
```

Prefix with `— ` (em-dash + space).

---

## 5. The Orb — brand persona

`components/common/SelfMindOrb.tsx`. Used on contemplative surfaces (welcome, splash, voice, breathing, chat intro). Renders inside a transparent `react-native-webview` so the `feTurbulence + feDisplacementMap` goo filter matches the website pixel-for-pixel. Don't add extra scale animations on top — it has its own breathing wobble.

Sizes: 180 (splash / voice mini), 200–220 (welcome), 260–320 (full hero).

---

## 6. Scrollable screens — always wrap in `FadingScrollWrapper`

Any screen with a `ScrollView`, `FlatList`, or `SectionList` **must** wrap it in `FadingScrollWrapper` from `components/get-rolling/ScrollFadeEdges.tsx`. Content fades at top and bottom edges so the scroll feels premium.

```tsx
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';

<View style={styles.container}>
  {/* sticky top bar — OUTSIDE the fade wrapper */}
  <View style={styles.topBar}>...</View>

  <FadingScrollWrapper topFadeHeight={32} bottomFadeHeight={64}>
    <ScrollView contentContainerStyle={...}>
      {/* all scrollable content */}
    </ScrollView>
  </FadingScrollWrapper>

  {/* pinned footer CTA — OUTSIDE the fade wrapper too */}
  <View style={styles.footer}>...</View>
</View>
```

Defaults: `topFadeHeight={32}`, `bottomFadeHeight={64}`. Do NOT wrap the entire screen (including the sticky top bar) in the fader — that fades the chrome.

**Always pass the right `bg` (or `topBg` / `bottomBg`).** The wrapper paints `bg → transparent` gradients over the scroll edges; the gradient only blends cleanly when its color matches what's actually behind it.

- Plain cream screen → no `bg` needed (default).
- Whole-screen tone bg (peach, lavender, sage, butter, cream2) → `bg={C.peach}` etc.
- Tone *wash* at the top + cream below (the practice-screen pattern): use **both** props — `topBg={C.peach}` (or whatever the wash color is) and let `bottomBg` default to cream.

Skipping this leaves a visible cream-tinted band over your tone surface — looks like a banding artifact, not a fade.

---

## 7. Pinned-footer CTA pattern

Onboarding primary CTAs **must pin at the bottom of the screen, OUTSIDE the ScrollView**. Putting the CTA inside the scroll content causes it to scroll off-screen on small devices and feel cheap. Reference: every onboarding screen with a `Continue` / `Begin` button.

Structure:

```tsx
<View style={styles.container}>
  <View style={styles.topBar}>...</View>
  <FadingScrollWrapper>
    <ScrollView>...content...</ScrollView>
  </FadingScrollWrapper>
  <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
    <TouchableOpacity style={styles.cta} onPress={goNext}>
      <Text style={styles.ctaText}>Continue</Text>
      <Glyphs.Arrow size={13} color={C.cream} />
    </TouchableOpacity>
  </View>
</View>
```

The CTA sibling of the scroll wrapper, not a child of the ScrollView.

---

## 8. Layout

- Safe-area insets on every screen top + bottom via `useSafeAreaInsets()`.
- Section horizontal padding: 20–24. Vertical: 18–32.
- Gaps between cards: 10–12.

---

## 9. Motion

- Easing: `Easing.bezier(0.2, 0.8, 0.2, 1)` or `Easing.out(Easing.cubic)`.
- Durations: 200–450ms for transitions, 2–4s for breathing loops.
- No bounce, no flash, no gradient shift on press.
- For page transitions and back behavior, see [routing.md](./routing.md) — that's the load-bearing rule set.

---

## 10. Keyboard handling — Android does NOT need `behavior="height"`

Android's `softwareKeyboardLayoutMode: "pan"` (set in `app.json`) already handles keyboard push-up natively. Adding `KeyboardAvoidingView` with `behavior="height"` on top leaves a **persistent bottom padding band** after the keyboard dismisses — reads as a ghostly "footer" and crops the primary CTA.

```tsx
<KeyboardAvoidingView
  style={styles.flex}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  keyboardVerticalOffset={0}
>
  {/* scroll + inputs */}
</KeyboardAvoidingView>
```

- iOS: `behavior="padding"` (works correctly).
- Android: `undefined` (passthrough). Do NOT use `"height"`.

---

## 11. Back-press dark flash (Android)

If you create a new stack `_layout.tsx`, set `contentStyle: { backgroundColor: '#FBF5EE' }` on its `screenOptions`. Without this, the system briefly reveals the dark Android activity window during back transitions. Pairs with `android:windowBackground` in `android/app/src/main/res/values/styles.xml` (already configured). Cream contentStyle on every Stack is non-negotiable.

---

## 12. Design source of truth

Mockups live in `/Users/warmachine37/Downloads/selfmind app design screens` — that's the only authoritative source for visual decisions on mobile screens. Don't confuse with the website folder (`mello-mind-journey`) or the app code itself; the website uses different tokens. When porting a screen from a mockup, read `mobile-styles.css` first and port verbatim to `BrandGlyphs.tsx`.

---

## Checklist before merging a screen

- [ ] Uses `BRAND` color tokens (no hardcoded hex except in `BrandGlyphs.tsx`).
- [ ] Chose the right Fraunces optical cut for the rendered size.
- [ ] `includeFontPadding: false` on any serif text ≥ 40px.
- [ ] Letter-spacing positive on body, ≤ +0.3 on headlines (no clipped italic tails).
- [ ] Kickers prefixed with `— ` (em-dash + space).
- [ ] Safe-area insets applied top and bottom.
- [ ] If scrollable → wrapped in `FadingScrollWrapper` with sticky chrome OUTSIDE.
- [ ] Primary CTA is pinned at the bottom OUTSIDE the ScrollView.
- [ ] Stack `_layout.tsx` (if new) sets `contentStyle: { backgroundColor: '#FBF5EE' }`.
- [ ] Uses `SelfMindOrb` on contemplative surfaces (not a custom circle).
- [ ] Copy passes voice rules (no clinical terms, no emoji, no exclamations).
- [ ] If routing involved, also satisfies [routing.md](./routing.md).
