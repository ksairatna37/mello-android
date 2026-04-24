# Mello — Claude Code Project Memory

Mello is a mental-health-first mobile app for Android and iOS, built with **Expo 54 + React Native 0.81 + React 19 + TypeScript**. This file is the shared mental model for AI coding assistants. Read it before making non-trivial changes.

> **Upcoming rebrand:** The product is being renamed **Mello → Self Mind** (bundle id: `selfmind`). The new design system uses a lighter purple palette (primary `#9B72F5`) and **DM Serif Text** as the primary font. The rename has NOT been applied yet — all existing files, classes, and the `mello-ui` skill still use the Mello name. Do not eagerly rename anything. See memory `reference_selfmind_design_system.md` for the target spec.

---

## Stack at a glance

| Layer | Choice |
|---|---|
| Framework | Expo 54 (managed + custom native modules), React Native 0.81.5, React 19 |
| Router | `expo-router` (file-based) with route groups `(auth)`, `(main)`, `(onboarding-new)`, `(get-rolling)` |
| Language | TypeScript strict mode, path alias `@/*` → repo root |
| State | React Context + vanilla pub/sub stores in `utils/*Store.ts`. **No Redux, Zustand, or MobX.** |
| Persistence | AsyncStorage via `@react-native-async-storage/async-storage` |
| Auth | Dual-mode: Supabase OAuth (Google Sign-In native) **and** backend email/OTP (AWS ECS) |
| Data API | REST to AWS ECS backend + Supabase for auth/profiles (`lib/supabase.ts`, `api/client.ts`) |
| Voice | Hume AI EVI (English, WebSocket) + LiveKit/Sarvam (Hindi) |
| Animation | `react-native-reanimated` v4 (worklets + shared values) |
| Styling | `StyleSheet.create` + `expo-linear-gradient`. **No Tailwind, no styled-components.** |
| Lists | `@shopify/flash-list` for anything scrollable > ~20 items |
| Builds | EAS with 3 profiles: `development`, `preview`, `production` |

---

## Project layout

```
app/                         # expo-router screens (file-based routing)
  (auth)/                    # signin, signup, forgot-password, auth/callback
  (main)/                    # tab nav: home, chat, chats, mood, journal, breathing, call, profile, settings
  (onboarding-new)/          # current onboarding (feat/onboarding-revamp) — 15+ screens
    _components/             # shared onboarding UI (QuestionPage, OptionCard, BatterySlider, LeafGrowth, DidYouKnow)
  (onboarding)/              # legacy onboarding (welcome, tour) — still referenced in routing
  (get-rolling)/             # guided-experience flow (breathing, presence, insight, style)
  index.tsx                  # SMART ROUTER — reads session + onboarding state, routes to correct flow
api/                         # REST client + endpoint map (AWS ECS backend)
components/                  # feature-grouped: auth/, chat/, common/, get-rolling/, home/, journal/,
                             #                  mood/, onboarding/, settings/, voice/
config/env.ts                # typed env var access; throws if required var missing
constants/                   # colors.ts, typography.ts, spacing.ts — the design system
contexts/AuthContext.tsx     # single source of truth for auth/session/profile (~900 LOC)
lib/supabase.ts              # Supabase client (AsyncStorage adapter, manual OAuth callback)
modules/audio/               # custom Expo module — Swift + Kotlin for low-latency mic/playback
services/                    # auth/, chat/, onboarding/ — API orchestration layer
utils/                       # stores (fullscreenStore, sidebarStore, chatNavStore),
                             # onboardingStorage, humeService, livekitService
assets/fonts/                # Outfit (9 weights) + DMSerif + Playwrite
android/, ios/               # native projects (prebuild output, customized)
app.config.js                # dynamic Expo config; injects env vars into `extra`
eas.json                     # 3 build profiles with shared env
```

---

## Design system (`constants/`)

**Colors** (`constants/colors.ts`)
- Brand: `#b9a6ff` (primary purple), `#e4c1f9` (pink), `#f8f7ff` (light bg)
- `Gradients.melloPrimary` = `['#b9a6ff', '#e4c1f9']` — brand fade
- `Gradients.melloChat` / `melloOrb` — cyan/mint/lime gradient for voice & chat screens
- Light/dark theme objects under `Colors.light` / `Colors.dark`
- **Note:** The onboarding-new flow uses a slightly different accent `#8B7EF8` with bg `#F2F0FF` — confirm with the design direction before reconciling. Don't silently "fix" one to match the other.

**Typography** (`constants/typography.ts`)
- Font: **Outfit** (9 weights). Accent fonts: **DMSerif** (logo), **Playwrite** (mello wordmark).
- In RN, `fontWeight` on `<Text>` doesn't pick the right weight-specific file — you must set `fontFamily` directly (`'Outfit-Bold'`, `'Outfit-SemiBold'`, etc.) or use the `getFontFamily(weight)` helper.
- Pre-built styles in `TextStyles`: `h1`, `h2`, `h3`, `body`, `bodySmall`, `caption`, `button`.

**Spacing** (`constants/spacing.ts`)
- Scale: `xs:4 / sm:8 / md:16 / lg:24 / xl:32 / 2xl:48 / 3xl:64`
- `screenHorizontal: 20`, `screenVertical: 24` — default screen padding
- `BorderRadius`: `sm:8 / md:12 / lg:16 / xl:24 / full:9999`
- `Shadows.sm/md/lg` — already include Android `elevation`

**Conventions**
- Generous whitespace — the app's aesthetic is "mental-health safe, breathing room."
- Every screen wraps in a gradient (`MelloGradient` or `GradientBackground`).
- Every screen uses `useSafeAreaInsets()` — never hardcode top/bottom padding.

---

## Routing rules

- **Smart entry:** `app/index.tsx` reads session + `getOnboardingData()` and redirects. Don't add a second router — extend this one.
- **Route groups** (parenthesized folders) don't affect URL path; they exist for shared `_layout.tsx`.
- **Typed routes are strict** — when pushing to a route that expo-router's type generator hasn't caught up on, use `router.replace('/(onboarding-new)/questions' as any)`. This is an existing convention, not a smell to fix.
- **Auth gates** belong in `app/index.tsx` or a layout — not scattered inside screens.

---

## Authentication rules

Auth has **two parallel paths**; both converge in `contexts/AuthContext.tsx`:

1. **Supabase OAuth (Google Sign-In)**
   - iOS requires SHA256 nonce generation (`expo-crypto`)
   - Tokens stored in AsyncStorage (NOT SecureStore — JWT > 2KB limit)
   - Callback handled manually via `Linking.addEventListener` in `app/_layout.tsx` (not auto URL detection)

2. **Backend email + OTP**
   - `services/auth/authApi.ts` talks to AWS ECS; session stored locally via `authStorage.ts`
   - `emailUser` + stored session power this path

**Always use the hook:** `const { user, emailUser, session, profile, authProvider } = useAuth()`. Don't import Supabase client or call `authApi` from screens directly — go through the context.

**Screen-level auth checks** should redirect from `app/index.tsx` or a group's `_layout.tsx`, not by ad-hoc `if (!user) router.replace(...)` inside components.

---

## Voice integrations

- **Hume EVI** — `utils/humeService.ts`. Direct WebSocket to `wss://api.hume.ai/v0/evi/chat`. Config id + API key from `ENV`. Used in `components/voice/VoiceAgentScreen.tsx`.
- **LiveKit + Sarvam (Hindi)** — `utils/livekitService.ts` fetches tokens from `/api/livekit-token`. Used in `components/voice/HindiVoiceScreen.tsx`. Currently gated / disabled in demo mode — check before enabling.
- **Audio I/O** — custom Expo module at `modules/audio` (Swift + Kotlin). Lazy-required: `const NativeAudio = require('@/modules/audio').default`. Prefer this for low-latency paths; use `expo-av` for prompts/effects.
- Microphone + speech-recognition permissions declared in `app.json` / `app.config.js`.

---

## State & storage rules

- **Auth & profile** → `contexts/AuthContext` only
- **Onboarding answers** → `utils/onboardingStorage.ts` (AsyncStorage; migration path to Supabase already sketched)
- **UI toggles** (fullscreen, sidebar, chat nav actions) → `utils/*Store.ts` vanilla subscribe/emit stores
- **Ephemeral screen state** → local `useState`
- **Do not** introduce Redux/Zustand/Jotai/Recoil without discussion. The current stack is deliberate.

---

## Build & environment

- **Env access** — always go through `import { ENV } from '@/config/env'`. Adding a new var: declare in `app.config.js` (`extra`), then in `config/env.ts` using `required()` or as optional.
- **Secrets** — `awsAccessKeyId`, `awsSecretAccessKey`, `humeApiKey` are currently bundled via EAS secrets at build time. **Known security issue:** AWS credentials shipped in the client bundle should move behind a server-side proxy. Flag this if you touch that code path; don't expand it.
- **EAS profiles**
  - `development` — dev client with hot reload
  - `preview` — internal TestFlight / internal App Sharing
  - `production` — stores; `autoIncrement: true`
- **Commands**
  - `npm start` — Expo dev server
  - `npm run ios` / `npm run android` — prebuild + run on device/simulator
  - `npx tsc --noEmit` — type check (no test suite configured yet)

---

## Conventions & patterns to follow

**File naming**
- Screens: `PascalCase.tsx` (e.g. `HomeScreen.tsx`) when inside `components/`, or `kebab-case.tsx` for route files under `app/` (e.g. `name-input.tsx`, `mood-history.tsx`)
- Utilities: `camelCase.ts` (e.g. `onboardingStorage.ts`)
- Stores: `camelCase` + `Store` suffix (e.g. `fullscreenStore.ts`)
- Folders: lower-case, feature-grouped

**Imports**
- Always use `@/` alias — never `../../../` relative imports across feature folders
- Group order: RN + React, third-party, `@/components`, `@/contexts`, `@/utils`, `@/constants`, local

**Screens (the standard scaffold)**
```tsx
import { View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import MelloGradient from '@/components/common/MelloGradient';
import { useAuth } from '@/contexts/AuthContext';

export default function ScreenName() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // ...
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
```

**Entrance-animation cascade (onboarding & hero screens)**
- Cascade `withDelay(60|180|300, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }))`
- Stagger header → content → CTA. Fade + translateY(12–16px).

**Animation easing — NEVER use spring or bounce physics**
- Use `withTiming` with `Easing.out(Easing.cubic)` or `Easing.inOut(Easing.cubic)` only.
- **Never** use `withSpring`, `withDecay`, `Easing.bounce`, `Easing.elastic`, or `LayoutAnimation.Presets.spring`. The app's tone is calm and predictable — springy motion clashes with that.
- Applies to Reanimated, core `Animated`, `LayoutAnimation`, Moti, and any CSS-style transition.

**Edge fades between sections — use `FadingScrollWrapper`**
Any time content needs to fade softly at the top/bottom of a scrollable or long section (instead of a hard cut-off), use the existing component — don't roll your own MaskedView + gradient.

```tsx
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';

<FadingScrollWrapper topFadeHeight={50} bottomFadeHeight={80}>
  <ScrollView>{/* ... */}</ScrollView>
</FadingScrollWrapper>
```

Defaults: top 50px, bottom 80px. Note the file is `ScrollFadeEdges.tsx` but the export is `FadingScrollWrapper` (also available as default export).

**Pressable > TouchableOpacity** — use `Pressable` everywhere; it's what the codebase already uses.

**Keyboard** — wrap text-entry screens in `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.

**Lists** — `FlashList` (not `FlatList`) for anything potentially > 20 items. Estimate `estimatedItemSize`.

**Error handling** — `try/catch` around API calls; fall back gracefully in UI (don't crash the screen). Don't swallow errors silently — at minimum `console.warn('[ServiceName]', err)`.

**Comments** — File headers with short purpose. Section separators `// ─── Section ───`. Skip obvious what-it-does comments.

---

## Known quirks & landmines

- **`expo-router` typed-routes + dynamic pushes** — cast with `as any` when TS complains about a known-valid path.
- **Google Sign-In on iOS requires nonce** — don't skip nonce generation or login silently fails.
- **Reanimated plugin must be LAST in babel plugin list** (`babel.config.js`). It currently is; don't move it.
- **AsyncStorage 2KB warnings** — some JWTs exceed 2KB; that's why we're not using SecureStore. Don't "fix" this without coordinating.
- **No test framework wired up yet** — don't claim tests pass; don't add a test config without discussion.
- **Large files to split carefully:** `contexts/AuthContext.tsx` (~900 LOC), `components/chat/ChatScreen.tsx` (~1400 LOC), `components/home/HomeScreen.tsx` (~725 LOC). Don't rewrite holistically; surgical edits only.
- **Do not replace the bottom nav.** `components/home/FloatingTabBar.tsx` is the final bottom nav for `(main)` screens. When porting prototype layouts that show a different/flat bottom nav, port the screen body only — leave the floating tab bar untouched.

---

## Shipping discipline

- **Plan mode before implementation** on anything touching auth, onboarding flow, voice, or navigation — these have cross-cutting effects.
- **iOS + Android parity** — test both before claiming done. Android's elevation doesn't behave identically to iOS shadow; check dark mode too.
- **Golden path before edge cases** — get the happy flow on both platforms, then harden.
- **Don't introduce new dependencies without discussion** — the dep surface is already large (68 deps). If you must add one, prefer Expo-managed or widely-used libs.

---

## Slash commands & skills configured for this project

See `.claude/skills/` and `.claude/agents/`.

| Skill | When it applies |
|---|---|
| `mello-ui` | Any UI work — enforces design tokens, fonts, gradients, shadows |
| `rn-feature` | Scaffolding a new feature folder under `components/` |
| `onboarding-screen` | Creating a new screen in `app/(onboarding-new)/` |
| `rn-perf` | Jank, slow startup, re-render problems, FlashList tuning |
| `rn-a11y` | Screen-reader labels, hit targets, contrast |
| `eas-build` | EAS profile changes, env vars, build/submit issues |

| Agent | When to delegate |
|---|---|
| `rn-reviewer` | Post-implementation RN-specific code review |
| `ui-designer` | Planning a new screen's look/layout before coding |
| `perf-auditor` | Deep-dive investigation of a performance problem |

---

## Prototype / wireframe reference

Location: `/Users/warmachine37/Desktop/mello prototyping/` (NOTE: space in folder name — quote when passing to shell)

This is the source-of-truth wireframe system for the full Self Mind redesign. When the user says "look at the prototype for X" or "check prototyping for X screen," **always read BOTH `screens.js` AND `annotations.js` for that screen id** — they're complementary and incomplete on their own:

- `js/screens.js` — all 32 screens as HTML strings. Each entry has `id`, `title`, `flow`, plus an `html` property with the rendered markup (colors, typography, layout, component shapes). This is the **visual spec**.
- `js/annotations.js` — a `const ANNOTATIONS = { ... }` object keyed by the SAME screen id. For each id it lists: **Purpose**, **API Calls**, **State Variables**, **Interactions**, **Edge Cases**, **Accessibility**, and sometimes **Self Mind AI Use** (how the voice/chat agent should behave on that screen). This is the **behavior spec**.
- `css/` — the design-system CSS (palette tokens, typography, chip/button/card classes).
- `index.html` — live viewer, `Ctrl+K` to search.
- `README.md` — full flow/screen index and brand/stack decisions.

**Lookup protocol** (do both in parallel):
1. `grep -n "id: '<screen-id>'" "/Users/warmachine37/Desktop/mello prototyping/js/screens.js"` → read the matched entry for visual spec.
2. `grep -n "'<screen-id>':" "/Users/warmachine37/Desktop/mello prototyping/js/annotations.js"` → read the matched annotation block for behavior + API + a11y.

Synthesize both before responding — screens.js without annotations misses API contract; annotations.js without screens.js misses the layout.

**Screen id vocabulary** (prefix → flow):
- `onb-*` Onboarding (`splash`, `q1`…`q5`, `profile`)
- `auth-*` Auth (`signup`, `otp`, `language`)
- `home-main` Home dashboard
- `voice-*` Voice Agent (`pre`, `active`, `summary`, `limit`)
- `chat-*` Chat (`home`, `active`, `crisis`)
- `journal-*` Journal (`home`, `new`, `view`, `insights`)
- `progress-*` Progress (`main`, `history`)
- `crisis-*` Crisis (`breathe`, `resources`)
- `profile-*` Profile (`main`, `plans`, `notifs`)
- `design-system` Design-system reference page

**Important caveats when porting from the prototype:**
- Prototype was written as HTML/CSS. Port by extracting the visual intent (colors, type scale, spacing, component shapes) — not by transcribing CSS class names.
- Prototype uses the NEW Self Mind palette (`#9B72F5` primary) and Sora/Inter fonts. The app currently uses the old Mello palette + Outfit. Until the rebrand lands, match the current codebase tokens unless the user says otherwise — see the rebrand banner at the top of this file.
- Prototype recommends Zustand / React Navigation v6; the app uses Context + expo-router. Don't introduce prototype's stack choices — keep the app's current architecture.
- Prototype mentions tech the app doesn't use yet (ElevenLabs, WatermelonDB, Razorpay). Treat these as "planned / future," not "should use now."

## External references

- [Expo 54 docs](https://docs.expo.dev/)
- [expo-router](https://docs.expo.dev/router/introduction/)
- [Reanimated v4](https://docs.swmansion.com/react-native-reanimated/)
- [FlashList](https://shopify.github.io/flash-list/)
- [LiveKit React Native](https://docs.livekit.io/reference/components/react-native/)
- [Hume EVI](https://dev.hume.ai/docs/empathic-voice-interface-evi/overview)

Last updated: 2026-04-23 (feat/onboarding-revamp)
