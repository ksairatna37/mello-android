# SelfMind App — Style Guide

Design system for the SelfMind mobile app. Mirrors the website
(`mello-mind-journey`) and the Claude Design mockups
(`/Users/warmachine37/Downloads/selfmind app design screens`).

Keep this document updated whenever a rule changes.

---

## Brand feel

Warm, unhurried, never clinical. The app should feel like talking to the
kindest version of yourself — a quiet room, not a product.

- Never clinical terms, diagnoses, or scores.
- Prefer *"notice / tend / sit with"* over *"track / monitor / analyze"*.
- No exclamation marks, no emoji in UI copy.
- First-person friendly: "you" for the user, "we" for SelfMind.

---

## Color tokens

Defined in `components/common/BrandGlyphs.tsx` as the exported `BRAND`
object. Import and use via destructure:

```tsx
import { BRAND as C } from '@/components/common/BrandGlyphs';
// C.cream, C.ink, C.coral, ...
```

| Token           | Hex        | Use                                         |
|-----------------|------------|---------------------------------------------|
| `coral`         | `#FF8A6B`  | Primary accent, CTAs                        |
| `coralDeep`     | `#E06A4B`  | Pressed/hover accent                        |
| `peach`         | `#FFD4B8`  | Warm surfaces, emotional cards              |
| `lavender`      | `#D8C6EC`  | Calm surfaces                               |
| `lavenderDeep`  | `#9B85C1`  | Night/deep states                           |
| `sage`          | `#B8D4C6`  | Growth, grounded                            |
| `butter`        | `#F5D98A`  | Optimism, highlight                         |
| `ink`           | `#1A1F36`  | Primary text, dark buttons/cards            |
| `ink2`          | `#4A4F66`  | Body text                                   |
| `ink3`          | `#7A7F96`  | Tertiary text, metadata                     |
| `cream`         | `#FAF6EE`  | **Main background — never pure white**      |
| `cream2`        | `#F2EDDF`  | Subtle panel bg                             |
| `paper`         | `#FFFFFF`  | Cards only, always with 1px line border     |
| `line`          | `#E8E2D2`  | Hairline border                             |
| `line2`         | `#D4CEBE`  | Stronger border                             |

**Background rule:** the base is always `cream`. Pure white is for cards only.

---

## Typography

### Fonts (loaded in `app/_layout.tsx`)

| Family name               | Underlying file                 | Use                             |
|---------------------------|----------------------------------|---------------------------------|
| `Fraunces-XL` / `-Italic` / `-Medium` / `-MediumItalic` | **144pt** cuts  | Big wordmarks, 46 px+ display   |
| `Fraunces` / `-Italic` / `-Medium` / `-MediumItalic`   | **72pt** cuts   | Headlines 20–44 px              |
| `Fraunces-Text` / `-Italic` / `-Medium` / `-MediumItalic` | **9pt** cuts  | Body 11–16 px                   |
| `Inter-Regular` / `-Medium` / `-SemiBold` / `-Bold`   | Inter           | UI, buttons, legal              |
| `JetBrainsMono` / `-Medium`                             | JetBrains Mono  | Kickers, mono labels            |

Pick the optical cut that matches the rendered size. Using 144pt for body
text makes it look anemic; using 9pt for big headlines looks chunky.
Browsers interpolate the variable axis automatically — native doesn't.

### Emphasis

Italic is the emphasis device. Inline via a nested `<Text>`:

```tsx
<Text style={styles.h1}>
  A little about <Text style={styles.h1Italic}>how I listen</Text>.
</Text>
```

Where `h1Italic` has `fontFamily: 'Fraunces-MediumItalic'`.

### Size scale (mobile)

Discrete steps: 10, 11, 13, 15, 16, 18, 24, 32, 44, 64.

### Letter-spacing

- Mono kickers/labels: `letterSpacing: 2.0–2.4` (positive, opens tracking)
- Headlines: `0` to `+0.3` — Fraunces headlines at display sizes don't need
  negative tracking; negative values clip the italic tail on Android.
- Body: `+0.15–0.2` for better readability in Fraunces-Text.

### Line heights

Generous: 1.25–1.5× font size. On Android, **set
`includeFontPadding: false`** for serif text over 40 px or it looks
cramped at the top edge.

---

## Components

### Buttons

Pill-shaped (`borderRadius: 999`). Three variants:

- **Primary** — `backgroundColor: ink`, `color: cream`, `Inter-Medium` 15 px
- **Secondary** — `backgroundColor: paper`, `borderWidth: 1, borderColor: line2`, `color: ink`
- **Ghost** — transparent, no border, `color: ink2`

### Cards

- `backgroundColor: paper`
- `borderRadius: 20–22`
- `borderWidth: 1, borderColor: line`
- `padding: 18`
- Variants: peach bg, ink dark bg, etc. — remove the border when the bg is
  a color token (peach/lavender/ink).

### Kickers

```tsx
<Text style={styles.kicker}>— before we begin</Text>
```

Where `kicker` has:
```ts
fontFamily: 'JetBrainsMono',
fontSize: 11,
letterSpacing: 2.2,
color: C.ink3,
textTransform: 'uppercase',
```

Prefix with `— ` (em-dash + space).

---

## The Orb (brand persona)

`components/common/SelfMindOrb.tsx`. Used on contemplative surfaces
(welcome, splash, voice, breathing, chat intro).

- Rendered inside a transparent `react-native-webview` so the
  `feTurbulence + feDisplacementMap` goo filter matches the website
  pixel-for-pixel.
- Fails gracefully to a cream-peach placeholder circle if the WebView
  native module isn't linked.
- Breathes via a wobble formula — don't add extra scale animations on top.

Default sizes: 180 (splash / voice mini), 200–220 (welcome), 260–320
(full hero).

---

## Scrollable screens

### Rule — always use `FadingScrollWrapper`

Any screen with a `ScrollView`, `FlatList`, or `SectionList` **must** wrap
it in `FadingScrollWrapper` from
`components/get-rolling/ScrollFadeEdges.tsx`. Content fades to transparent
at the top and bottom edges, so the scroll motion doesn't look cropped
and the screen feels premium.

**Default values:**
- `topFadeHeight={32}` — small, just a subtle feather below the app bar
- `bottomFadeHeight={64}` — larger, so the primary CTA emerges smoothly

**Structure:**

```tsx
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';

<View style={styles.container}>
  {/* sticky top bar — OUTSIDE the fade wrapper */}
  <View style={styles.topBar}>...</View>

  <FadingScrollWrapper topFadeHeight={32} bottomFadeHeight={64}>
    <ScrollView contentContainerStyle={...}>
      {/* all scrollable content, including the primary CTA button at the
          bottom of contentContainer — the fade reveals it gracefully */}
    </ScrollView>
  </FadingScrollWrapper>
</View>
```

**Do NOT** wrap the entire screen (including a sticky top bar) in the
fader — that would fade the chrome too.

**Reference implementation:**
`app/(onboarding-new)/credibility.tsx` (see `FadingScrollWrapper` usage).

---

## Layout

- Safe-area insets on every screen top + bottom via
  `useSafeAreaInsets()`.
- Section horizontal padding: 20–24. Vertical: 18–32.
- Gaps between cards: 10–12.
- Tab bar at the bottom of the main app (home · voice · chat · journal ·
  profile). See `components/common/MBTabBar` pattern in the mockups.

---

## Motion

- Easing: `cubic-bezier(.2, .8, .2, 1)` — Reanimated
  `Easing.bezier(0.2, 0.8, 0.2, 1)` or the simpler
  `Easing.out(Easing.cubic)`.
- Durations: 200–450 ms for transitions, 2–4 s for breathing loops.
- No bounce. No flash. No gradient shift on press.
- Page transitions use the OS default (push/back). Inside
  RouterGate-driven flows, see **Navigation → Back transitions** below
  — those flows use `router.push` forward and `router.replace(parent)`
  backward, with `animationTypeForReplace: 'pop'` on the stack so the
  back direction reads correctly.

---

## Keyboard / TextInput screens

### Don't use `KeyboardAvoidingView` with `behavior="height"` on Android

Android's `softwareKeyboardLayoutMode: "pan"` (set in `app.json`) already
handles keyboard push-up natively. Adding `KeyboardAvoidingView` with
`behavior="height"` on top of it leaves a **persistent bottom padding band**
after the keyboard dismisses — reads as a ghostly "footer" and crops any
content near the bottom (e.g. the primary CTA).

**Do this:**

```tsx
<KeyboardAvoidingView
  style={styles.flex}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  keyboardVerticalOffset={0}
>
  {/* ...scroll + inputs... */}
</KeyboardAvoidingView>
```

- iOS uses `behavior="padding"` (works correctly there).
- Android uses `undefined` (passthrough) so the OS handles keyboard adjustment.

Reference: `app/(onboarding-new)/name-input.tsx`.

---

## Navigation

### Stack transition timing — target ~850 ms, smooth/slow

Every stack `_layout.tsx` uses:

```tsx
<Stack
  screenOptions={{
    headerShown: false,
    animation: 'slide_from_right',
    gestureEnabled: true,
  }}
/>
```

**Timing target: ~850 ms** — the "smooth slow" feel the user tuned to on
welcome → credibility. On Android this maps to the platform default for
`slide_from_right` (no explicit `animationDuration` needed — the default
Material curve lands around that mark). Do NOT override with a faster
value:

- `animationDuration: 420` felt snappy / fast — rejected.
- `animationDuration: 600` still felt fast — rejected.
- No explicit duration (system default) ≈ 850 ms — **accepted**.

If you need to explicitly set duration (e.g. for a one-off screen),
use `850` — never under. When swapping animation types, verify the
rendered timing still reads as "deliberate, not rushed".

**Known trade-off:** Android `slide_from_right` renders a system-level
dim scrim over the outgoing card. It's not a JS-configurable overlay —
it's baked into native-stack's Material transition. `ios_from_right`
avoids the dim but runs snappier (~350 ms default) and no
`animationDuration` override matched the 850 ms feel. If the dim
becomes a blocker, the right fix is a custom Reanimated transition; do
not try to "patch" it with a cream `contentStyle` background (confirmed
ineffective) or with `cardOverlayEnabled: false` (JS-Stack-only,
native-stack ignores it).

Applied across: `app/_layout.tsx`, `app/(onboarding)/_layout.tsx`,
`app/(onboarding-new)/_layout.tsx`.

### Navigation methods

- `router.push(path)` — forward step, goes into stack, back pops.
- `router.replace(path)` — terminal commits (post-signup → home) AND
  the back-handler pattern below (RouterGate-driven flows).
- `router.back()` — only safe when you control the push that placed
  the current screen on the stack. Inside RouterGate-driven flows
  (auth + onboarding) `canGoBack()` can lie because RouterGate may
  have replaced `/` with the current screen on cold-boot resume; back
  pops to `/` and RouterGate re-routes you to the same screen → loop.
  In those flows use the replace-back pattern below.
- Android hardware back: always intercept with `useFocusEffect`.

### NEVER auto-redirect from a screen on mount (ghost-screen rule)

Do not put `router.replace(...)` or `router.push(...)` inside a
mount-time `useEffect` that runs unconditionally on visit. That makes
the screen a "ghost" — every time someone navigates to it, it
forwards them somewhere else, and the back stack lies. Symptom: back
from screen B routes to screen A (which is supposed to be the parent),
A immediately forwards to B again, user is trapped.

Concrete example we hit (and ripped out): `name-input.tsx` used to
`router.replace('/questions')` for any Google-authed user. From `/Q1`
hardware back replaces with `/name-input` → name-input redirects to
`/questions` → user is on Q1 again. Loop, every time.

Rules:

- Conditional content goes in **render** (return different JSX), not in
  navigation. Pre-fill a field, show a different CTA, hide a section —
  but always render the screen.
- Cross-screen routing decisions go in **RouterGate**, not in screens.
  Screens make navigation calls only in response to user actions
  (button taps, hardware back, etc.).
- The one acceptable mount-effect redirect is a **defensive guard for
  off-spec state** (e.g. `verify-email` redirects to `/welcome` when
  `pendingEmail` is null AND not verifying — safety net for an
  impossible-but-not-impossible state). Comment why it's safe and
  guard it tightly so it can't fire on the happy path.

### Back transitions in RouterGate-driven flows (auth + onboarding)

Cold-boot resume can land a user mid-flow with no real back stack —
`router.back()` is unsafe. The pattern is:

- **Back-handlers call `router.replace(parent)`**, never `router.back()`.
- **The stack sets `animationTypeForReplace: 'pop'`** so replace
  animates as a slide-out-to-right (true back motion) instead of the
  default push slide-in-from-right.
- **Forward navigation uses `router.push`**, never `router.replace`,
  unless the destination must be unreachable via back. (Forward
  `router.replace` would also pick up the `pop` animation and look
  like a back step.)

When the forward destination would otherwise let the user pop back to
a stale screen (e.g. `/permissions` → `/welcome-aboard`, where
returning to `/permissions` after auth completion is meaningless), let
the destination block hardware back via `useFocusEffect` +
`BackHandler.addEventListener('hardwareBackPress', () => true)`. That
keeps `push` safe without needing `replace`.

Applied in:
- `app/(onboarding)/_layout.tsx` — `animationTypeForReplace: 'pop'` on
  the stack screenOptions.
- Every onboarding screen back-handler — `router.replace(parent)`.
- Forward steps: `questions → analysing`, `analysing → your-reading`,
  `your-reading → save-profile / welcome-aboard`,
  `permissions → welcome-aboard` — all `router.push`.

---

## Checklist before shipping a screen

- [ ] Uses `BRAND` color tokens (no hardcoded hex except in
      this file's tokens)
- [ ] Chose the right Fraunces optical size for rendered size
- [ ] Letter-spacing doesn't clip italic tails
      (no heavy negatives on big headlines)
- [ ] `includeFontPadding: false` on any serif text ≥ 40 px
- [ ] Body copy has `letterSpacing: +0.15–0.2` if using `Fraunces-Text`
- [ ] Kickers prefixed with `— `
- [ ] Safe-area insets applied
- [ ] If scrollable → wrapped in `FadingScrollWrapper`
- [ ] `router.push` forward; `router.back()` backward outside
      RouterGate-driven flows; `router.replace(parent)` backward
      inside them (with `animationTypeForReplace: 'pop'` on the stack)
- [ ] Uses `SelfMindOrb` on contemplative surfaces (not a custom circle)
- [ ] Copy passes the voice rules (no clinical terms, no emoji,
      no exclamations)
