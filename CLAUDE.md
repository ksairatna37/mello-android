# SelfMind — Claude Code Project Memory

SelfMind (formerly Mello) is a mental-health-first mobile app for Android and iOS, built with **Expo 54 + React Native 0.81 + React 19 + TypeScript**. This file is the shared mental model for AI coding assistants. Read it before making non-trivial changes.

> **Rebrand status:** PARTIAL. The new SelfMind design system has landed across the entire onboarding flow (`app/(onboarding)/*`). Legacy main-app screens (home, chat, settings, voice, etc.) still render with the old Mello tokens (`constants/colors.ts`, `MelloGradient`, Outfit). Two design systems coexist; do not silently "fix" one to match the other. The main-app redesign is upcoming, not done.

> **MUST-READ rules.** Before any work in these areas, read the matching rule file:
> - **Routing, back-handlers, redirects, RouterGate, new Stack layouts:** [`rules/routing.md`](./rules/routing.md)
> - **New page design, color/typography choices, scrollable views, pinned CTAs:** [`rules/page-design.md`](./rules/page-design.md)
> - **Auditing / diffing design ↔ code, sweeping the codebase for drift:** [`rules/audit-via-search.md`](./rules/audit-via-search.md)
> - **Adding or changing ANY Fraunces text style (display, body, sheets) — Android descender clipping:** [`rules/android-text-cropping.md`](./rules/android-text-cropping.md)
>
> Index: [`rules/README.md`](./rules/README.md). These are codified scar tissue from past incidents — breaking a rule almost always re-introduces a bug we already fixed.

---

## Stack at a glance

| Layer | Choice |
|---|---|
| Framework | Expo 54 (managed + custom native modules), React Native 0.81.5, React 19 |
| Router | `expo-router` (file-based) with route groups `(main)` and `(onboarding)` |
| Language | TypeScript strict mode, path alias `@/*` → repo root |
| State | React Context + vanilla pub/sub stores in `utils/*Store.ts`. **No Redux, Zustand, or MobX.** |
| Persistence | AsyncStorage via `@react-native-async-storage/async-storage` |
| Auth | Dual-mode: Supabase OAuth (Google Sign-In native) **and** backend email/OTP (AWS ECS) |
| Data API | REST to AWS ECS backend + Supabase for auth/profiles (`lib/supabase.ts`, `api/client.ts`) |
| Voice | Hume AI EVI (English, WebSocket) + LiveKit/Sarvam (Hindi) |
| Animation | `react-native-reanimated` v4 (worklets + shared values) |
| Styling | `StyleSheet.create` + `expo-linear-gradient`. **No Tailwind, no styled-components.** |
| Lists | `@shopify/flash-list` for anything scrollable > ~20 items |
| Tests | `jest` + `ts-jest` for pure-function unit tests (`__tests__/*.test.ts`) |
| Builds | EAS with 3 profiles: `development`, `preview`, `production` |

---

## Project layout

```
app/                         # expo-router screens (file-based routing)
  (main)/                    # tab nav: home, chat, chats, mood, journal, breathing, call, profile, settings
  (onboarding)/              # current onboarding (12 screens, SelfMind redesign)
    _components/             # shared onboarding UI (QuestionPage, OptionCard, BatterySlider, LeafGrowth, DidYouKnow)
    _layout.tsx              # Stack registration of the active route chain
  index.tsx                  # SMART ROUTER — reads session + onboarding state, routes to correct flow
  _layout.tsx                # Root layout: fonts, providers, migrateOnboardingData() on boot
api/                         # REST client + endpoint map (AWS ECS backend)
components/                  # feature-grouped: auth/, chat/, common/, get-rolling/, home/, journal/,
                             #                  mood/, onboarding/, settings/, voice/
config/env.ts                # typed env var access; throws if required var missing
constants/                   # LEGACY tokens — colors.ts, typography.ts, spacing.ts (Mello)
contexts/AuthContext.tsx     # single source of truth for auth/session/profile (~830 LOC)
lib/supabase.ts              # Supabase client (AsyncStorage adapter, manual OAuth callback)
modules/audio/               # custom Expo module — Swift + Kotlin for low-latency mic/playback
plugins/with-android-light-theme.js   # config plugin for back-press dark-flash fix
services/                    # auth/, chat/, onboarding/ — API orchestration layer
utils/                       # stores (fullscreenStore, sidebarStore, chatNavStore),
                             # onboardingStorage, onboardingProgress, humeService, livekitService
__tests__/                   # jest unit tests (validators, deterministic profile, progress helper)
__mocks__/                   # jest stubs for ESM native deps (expo-crypto, expo-constants)
docs/                        # ONBOARDING_FLOW.md = single source of truth for the onboarding architecture
scripts/check-android-theme.mjs       # post-prebuild theme assertion
.github/workflows/ci.yml     # typecheck + jest on push/PR
assets/fonts/                # Fraunces (XL/72pt cuts) + Outfit (legacy) + DMSerif/Playwrite (legacy)
android/, ios/               # native projects (prebuild output, customized)
app.config.js                # dynamic Expo config; injects env vars into `extra`
eas.json                     # 3 build profiles with shared env
```

---

## Two design systems (read this before any UI work)

### NEW — SelfMind, used in `app/(onboarding)/*`

Source of truth: [`components/common/BrandGlyphs.tsx`](components/common/BrandGlyphs.tsx). This file is a verbatim port of the Claude Design mockups in `/Users/warmachine37/Downloads/selfmind app design screens/mobile-styles.css`. Update both when tokens change.

**Colors** — `BRAND` export:
- Surfaces: `cream` `#FBF5EE` (canvas), `cream2` `#F3ECDF`, `paper` `#FFFFFF`
- Text: `ink` `#1A1F36`, `ink2` `#4A4F67`, `ink3` `#7A7F92`
- Hairlines: `line`, `line2` (rgba on ink)
- Accents: `peach` `#F4D3BC`, `coral` `#F4A988`, `lavender` `#D9D6F3`, `lavenderDeep` `#4D408A`, `sage` `#CFE0C8`, `butter` `#F1E4B2`

**Typography** — `TYPE` export:
- Display: `Fraunces` (72pt cut for 20–44px headlines), `Fraunces-XL` (144pt for splash/wordmarks), `Fraunces-Text` (9pt for 11–16px body)
- Body UI: `Inter-Regular` / `Medium` / `SemiBold` / `Bold`
- Kickers (mono): `JetBrainsMono` / `JetBrainsMono-Medium` — see `TYPE.kickerStyle` for the standard wide-tracked uppercase style

**Radii / shadow** — `RADIUS` (`card: 22`, `chip: 999`, `btn: 999`, `tabbar: 28`) and `SHADOW` (`sm`, `md`, `tabbar`).

**Canvas convention:** new screens use a **flat cream background** (`backgroundColor: BRAND.cream`), not a gradient. Pinned-footer CTA pattern (see below). Generous whitespace, italic emphasis on key Fraunces words.

**Orb gradients are an exception to the tokens rule.** `components/common/SelfMindOrb.tsx` uses the website's saturated hues (`#FFD4B8`, `#FF8A6B`, `#9B85C1`, `#F5D98A`) instead of the muted mobile palette. This matches the design's `MBOrb` reference and is intentional — the orb is meant to glow vibrantly regardless of the ambient palette. Don't "fix" it to use BRAND tokens.

**Before any new mobile screen work:** verify `mobile-styles.css` and the relevant `MB*` reference component haven't drifted from `BrandGlyphs.tsx`. If they have, update BrandGlyphs first, then write the screen. Never hardcode brand hex values in screen styles, and **never reach for the website (`mello-mind-journey`) palette from memory** — the two systems share DNA but the mobile values are softer (`#F4A988` coral, not the website's `#FF8A6B`).

### LEGACY — Mello, used in `(main)/*` + most `components/*`

Source of truth: `constants/colors.ts`, `constants/typography.ts`, `constants/spacing.ts`.

- Brand purple `#b9a6ff`, pink `#e4c1f9`, light bg `#f8f7ff`
- `Gradients.melloPrimary` for `MelloGradient` / `GradientBackground` wrappers
- Font: **Outfit** (9 weights) + DMSerif (logo) + Playwrite (mello wordmark)
- In RN, set `fontFamily` directly (`'Outfit-Bold'`) — `fontWeight` doesn't pick the right weight file

**Don't migrate one to the other ad-hoc.** When the main-app redesign starts, it'll port screen-by-screen with explicit user direction.

---

## Routing rules

- **Smart entry:** `app/index.tsx` reads session + `getOnboardingData()` and redirects. Don't add a second router — extend this one.
- **Fresh-start guarantee:** until onboarding is fully complete (`profile.onboarding_completed === true`), every fresh launch wipes local onboarding answers and routes to `/welcome`. No mid-flow resume. See `docs/ONBOARDING_FLOW.md` § 2.
- **Route groups** (parenthesized folders) don't affect URL path; they exist for shared `_layout.tsx`.
- **Typed routes are strict** — when pushing to a route that expo-router's type generator hasn't caught up on, use `router.push('/(onboarding)/credibility' as any)`. This is an existing convention, not a smell to fix.
- **Forward navigation in onboarding uses `router.replace`, not `router.push`.** Pushing creates a back-stack loop (we've shipped two regressions from this: permissions ↔ welcome-aboard, and save-profile back-to-analysing). Reserve `push` for cases where the user genuinely needs to back out of the new screen onto the previous one.
- **Auth gates** belong in `app/index.tsx` or a layout — not scattered inside screens.
- **Hardware back handlers belong in `useFocusEffect`, not `useEffect`.** Otherwise the listener stays registered after the screen unfocuses and intercepts back presses meant for the new screen. Pattern in `app/(onboarding)/welcome.tsx` is the canonical example, including a `backHandlingRef` race-guard for rapid double-presses that would otherwise stack alerts.

---

## Onboarding architecture

The onboarding flow has its own dedicated doc: **[`docs/ONBOARDING_FLOW.md`](docs/ONBOARDING_FLOW.md)**. Read it before touching any of:

- `app/(onboarding)/*`
- `contexts/AuthContext.tsx` (auth-routing logic)
- `services/chat/bedrockService.ts` (validator + deterministic profile)
- `utils/onboardingStorage.ts` (schema + migration)

Three load-bearing facts that must stay true:

1. **Single source of truth for storage:** `OnboardingData` in `utils/onboardingStorage.ts` lists every field the flow may persist locally. Adding a field? Update the type. Removing a field? Add the key to `LEGACY_KEYS` in `migrateOnboardingData()` so existing payloads get cleaned. The migration runs once on boot from `app/_layout.tsx`.
2. **Validator gates the reading:** `validateProfile()` rejects (or overrides) any LLM output that's missing fields, has collapsed scores, matches the prompt example verbatim, or contradicts itself ("your calm is a foundation" with calm=25). Tested in `__tests__/validateProfile.test.ts`. Mental-health-grade — we'd rather show the soft fallback than ship misleading numbers.
3. **Last-resort fallback exists:** `composeDeterministicProfile()` builds a heuristic profile from the user's own answers if Bedrock fails twice. Clamped to `[5, 95]`. Tested in `__tests__/composeDeterministicProfile.test.ts`.

---

## Authentication rules

Auth has **two parallel paths**; both converge in `contexts/AuthContext.tsx`:

1. **Supabase OAuth (Google Sign-In)**
   - iOS requires SHA256 nonce generation (`expo-crypto`). The `nonce` field is cast to `any` because it's accepted at runtime but missing from the SDK's `ConfigureParams` type — known divergence.
   - Tokens stored in AsyncStorage (NOT SecureStore — JWT > 2KB limit)
   - Callback handled manually via `Linking.addEventListener` in `app/_layout.tsx` (not auto URL detection)

2. **Backend email + OTP**
   - `services/auth/authApi.ts` talks to AWS ECS; session stored locally via `authStorage.ts`
   - `emailUser` + stored session power this path

**Always use the hook:** `const { user, emailUser, session, profile, authProvider } = useAuth()`. Don't import Supabase client or call `authApi` from screens directly — go through the context.

**Pre-auth onboarding answers** are detected via `hasMeaningfulOnboardingAnswers()` in `utils/onboardingProgress.ts` (pure, unit-tested). Used by AuthContext to decide whether post-auth users go forward (→ permissions) or back (→ credibility re-do).

**Screen-level auth checks** redirect from `app/index.tsx` or a group's `_layout.tsx`, not by ad-hoc `if (!user) router.replace(...)` inside components.

---

## Voice integrations

- **Hume EVI** — `utils/humeService.ts`. Direct WebSocket to `wss://api.hume.ai/v0/evi/chat`. Config id + API key from `ENV`. Used in `components/voice/VoiceAgentScreen.tsx`.
- **LiveKit + Sarvam (Hindi)** — `utils/livekitService.ts` fetches tokens from `/api/livekit-token`. Used in `components/voice/HindiVoiceScreen.tsx`. Currently gated / disabled in demo mode — check before enabling.
- **Audio I/O** — custom Expo module at `modules/audio` (Swift + Kotlin). Lazy-required: `const NativeAudio = require('@/modules/audio').default`. Prefer this for low-latency paths; use `expo-av` for prompts/effects.
- Microphone + speech-recognition permissions declared in `app.json` / `app.config.js`.

---

## State & storage rules

- **Auth & profile** → `contexts/AuthContext` only
- **Onboarding answers** → `utils/onboardingStorage.ts` (AsyncStorage; the `OnboardingData` interface is the schema's single source of truth — see `docs/ONBOARDING_FLOW.md` § 6)
- **UI toggles** (fullscreen, sidebar, chat nav actions) → `utils/*Store.ts` vanilla subscribe/emit stores
- **Ephemeral screen state** → local `useState`
- **Do not** introduce Redux/Zustand/Jotai/Recoil without discussion. The current stack is deliberate.

---

## Build & environment

- **Env access** — always go through `import { ENV } from '@/config/env'`. Adding a new var: declare in `app.config.js` (`extra`), then in `config/env.ts` using `required()` or as optional.
- **Secrets** — `awsAccessKeyId`, `awsSecretAccessKey`, `humeApiKey` are bundled via EAS secrets at build time. **Known security issue:** AWS credentials shipped in the client bundle should move behind a server-side proxy. Flag this if you touch that code path; don't expand it.
- **EAS profiles**
  - `development` — dev client with hot reload
  - `preview` — internal TestFlight / internal App Sharing
  - `production` — stores; `autoIncrement: true`
- **Commands**
  - `npm start` — Expo dev server
  - `npm run ios` / `npm run android` — prebuild + run on device/simulator
  - `npm run typecheck` — `tsc --noEmit -p .`
  - `npm test` — jest unit tests (`__tests__/*.test.ts`)
  - `npm run check:theme` — post-prebuild assertion that the back-press-flash fix is intact
- **CI** — `.github/workflows/ci.yml` runs typecheck + tests on every push/PR. Native build lives in EAS.

---

## Mental-health-grade output rules

Anything that produces a number, label, or interpretation a user will read about themselves must be validated before display.

- **Reading screen** (`your-reading.tsx`) is gated by `validateProfile()`. Never bypass it.
- **Analysing screen** (`analysing.tsx`) owns the gate: poll cache → retry at higher temp → deterministic fallback → save → reveal Continue. The Continue button must not appear until a validated profile is available.
- **Don't backfill missing scores with a "neutral" default.** The user might trust it. Reject and fall back instead.
- **If you add a new dimension or text field**, add it to the validator's required keys and contradiction checks before shipping.
- **Never fabricate clinical, scientific, or research-style claims** (e.g. "studies show 6 seconds of mindful breathing rewires your amygdala"). If asked to write a "did you know" or stat-style fact and you don't have a real source, use plain-language framings ("Naming what we feel can soften it.") or ask the user. Hit this on `DidYouKnow.tsx` — a fabricated "6s" claim almost shipped.

**Audio packages — `expo-av` + `expo-audio` coexist** (deliberate; do not migrate the recording call-sites without a scoped PR):
- `expo-av` is used ONLY for recording: `app/(onboarding)/permissions.tsx`, `components/chat/Recordingbar.tsx`, `components/voice/VoiceAgentScreen.tsx`. Don't write new playback code against it — it's deprecated.
- `expo-audio` is used ONLY for Sound Spaces playback (`components/spaces/useAmbientBed.ts`). Don't write recording code against it yet.
- Both packages share the underlying iOS `AVAudioSession` / Android `AudioManager`. Calling `setAudioModeAsync` from one silently overrides the other. The voice agent currently sets `staysActiveInBackground:false` via expo-av, which strips the bed's background-playback + lock-screen rights. Mitigation: `useAmbientBed` re-applies the contemplative session on every Sound Space mount. If you add a new playback consumer, follow the same re-apply pattern; do NOT use a `sessionConfigured` once-per-process latch.

**Surface-specific risk acceptances** (deliberate exceptions to the default "every immersive surface needs a crisis affordance" rule — documented so future audits don't re-flag):
- **Sound Spaces sitting screen** (`app/(main)/space.tsx` → `components/spaces/SelfMindSoundSpaceSitting.tsx`): no in-room crisis link. STEP OUT (chip + Android hardware back) returns the user to the catalog `/spaces`. The catalog itself is one tap from `/home`, which surfaces the rest of the app's support paths. Decision rationale: this is a contemplative, non-interactive surface (no chat, no input, no AI reply, no journal) — a crisis link would clutter the field without measurable safety value, and adding text the user must scan-past every session works against the "stay as long or as short as you like" voice. Trade-off accepted by product; do NOT re-add a crisis ghost link without a corresponding product decision and an update to this section.

---

## UI conventions & patterns

**File naming**
- Screens: `PascalCase.tsx` when inside `components/`, `kebab-case.tsx` for route files under `app/`
- Utilities: `camelCase.ts` (e.g. `onboardingStorage.ts`)
- Stores: `camelCase` + `Store` suffix (e.g. `fullscreenStore.ts`)
- Folders: lower-case, feature-grouped

**Imports**
- Always use `@/` alias — never `../../../` relative imports across feature folders
- Group order: RN + React, third-party, `@/components`, `@/contexts`, `@/utils`, `@/constants`, local

**Standard scaffold — NEW (SelfMind, cream canvas)**
```tsx
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BRAND as C, TYPE } from '@/components/common/BrandGlyphs';

export default function ScreenName() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={[styles.inner, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        {/* content */}
      </View>
      <View style={styles.footer}>{/* pinned CTA */}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  inner:     { flex: 1, paddingHorizontal: 24 },
  footer:    { paddingHorizontal: 24 },
});
```

**Pinned-footer CTA pattern (onboarding)**
- Primary CTAs pin at the bottom, **outside any ScrollView** — so the action stays discoverable without forcing scroll.
- Implementation: wrap scrolling content in `<ScrollView>`, close it, render the CTA in a sibling `<View style={styles.footer}>` with `paddingBottom: insets.bottom + 16`. Don't add `insets.bottom` to the ScrollView's `contentContainerStyle` (would double-pad).
- Default to pinned-footer for any new onboarding screen unless it falls into one of these confirmed exceptions:
  - **Auth forms** (`save-profile.tsx`, `verify-email.tsx`) — pinning splits input + submit and pushes secondary auth options above the primary action.
  - **Short hero screens** that fit without scrolling — no scroll to escape, CTA can stay inline.
  - **Card-as-CTA designs** — `your-reading.tsx`'s coral "Save card" is itself the CTA region; the button lives inside the card, not in a global footer.

**Standard scaffold — LEGACY (Mello, gradient canvas)**
```tsx
import MelloGradient from '@/components/common/MelloGradient';
// ...
<View style={styles.container}>
  <MelloGradient />
  <View style={[styles.inner, { paddingTop: insets.top + 8 }]}>{/* ... */}</View>
</View>
```
Keep using this in legacy `(main)` screens until the redesign reaches them.

**Entrance-animation cascade** — `withDelay(60|180|300, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }))`. Stagger header → content → CTA. Fade + translateY(12–16px).

**Animation easing — NEVER use spring or bounce physics**
- Use `withTiming` with `Easing.out(Easing.cubic)` or `Easing.inOut(Easing.cubic)` only.
- **Never** use `withSpring`, `withDecay`, `Easing.bounce`, `Easing.elastic`, or `LayoutAnimation.Presets.spring`. The app's tone is calm and predictable — springy motion clashes with that.
- Applies to Reanimated, core `Animated`, `LayoutAnimation`, Moti, and any CSS-style transition.

**Edge fades — use `FadingScrollWrapper`**
```tsx
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';

<FadingScrollWrapper topFadeHeight={50} bottomFadeHeight={80} bg={C.cream}>
  <ScrollView>{/* ... */}</ScrollView>
</FadingScrollWrapper>
```

**The `bg` prop is load-bearing** — it must match the screen's actual background colour. The wrapper paints two `LinearGradient`s (`bg → transparent`) over the content; if `bg` doesn't match, you get a visible **white/cream halo** at the edge against non-cream screens. Symptom: a faint pale band hugging the top-right or bottom of the scroll area on peach / ink / tonal screens.

Defaults to `BRAND.cream` (the common case). Pass `bg` for any non-cream screen:
- Peach screens (name-input, welcome-aboard) → `bg={C.peach}`
- Ink screens (DidYouKnow) → `bg={C.ink}`
- Tonal QuestionPage → `bg` matches the per-question color

Don't roll your own MaskedView + gradient — MaskedView leaks dark gradient bleed during Android native-stack transitions (settled debate; the file's header has the full v1 → v1a → v2 history).

**Pressable > TouchableOpacity** — use `Pressable` everywhere; it's what the codebase already uses.

**Keyboard** — wrap text-entry screens in `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.

**Lists** — `FlashList` (not `FlatList`) for anything potentially > 20 items. Estimate `estimatedItemSize`.

**Error handling** — `try/catch` around API calls; fall back gracefully in UI (don't crash the screen). Don't swallow errors silently — at minimum `console.warn('[ServiceName]', err)`.

**Comments** — File headers with short purpose. Section separators `// ─── Section ───`. Skip obvious what-it-does comments.

---

## Back-press dark flash fix (Android)

A four-layer remedy. If you see a dark flash during back transitions on Android, one layer has been removed. Run `npm run check:theme` after any prebuild to verify.

1. **Config plugin** — `plugins/with-android-light-theme.js` sets `AppTheme` parent to `Theme.AppCompat.Light.NoActionBar`, pins `windowBackground=@color/appCanvas`, sets `forceDarkAllowed=false`. Re-applied every prebuild (otherwise `prebuild --clean` wipes manual `styles.xml` edits).
2. **Predictive-back disable** — same plugin sets `enableOnBackInvokedCallback="false"` on the Android `<application>` tag. Without this, Android 14 paints a dim scrim over the outgoing screen.
3. **`contentStyle` on every Stack** — `{ backgroundColor: '#FBF5EE' }` so the React Navigation transition canvas is always cream.
4. **ScrollFadeEdges overlay (not MaskedView)** — see "Edge fades" above.

Don't delete the config plugin from `app.config.js` plugins list. The check script will catch you, but the regression hits real users first.

---

## Known quirks & landmines

- **`expo-router` typed-routes + dynamic pushes** — cast with `as any` when TS complains about a known-valid path.
- **Google Sign-In on iOS requires nonce** — don't skip nonce generation or login silently fails. The `nonce` field is cast `as any` in the configure call (runtime-supported, missing from SDK types).
- **Reanimated plugin must be LAST in babel plugin list** (`babel.config.js`). It currently is; don't move it.
- **Reanimated `SharedValue` import** — `import type { SharedValue } from 'react-native-reanimated'` (not `Animated.SharedValue<...>` — the namespace path no longer exports it).
- **AsyncStorage 2KB warnings** — some JWTs exceed 2KB; that's why we're not using SecureStore. Don't "fix" this without coordinating.
- **Native modules with ESM imports** — `expo-crypto` and `expo-constants` use ESM at module load time. Jest tests stub them via `__mocks__/`. If you add a test that pulls in a service touching another native module, you may need a similar stub.
- **`adjustsFontSizeToFit` is asymmetric across platforms.** iOS shrinks aggressively to *any* size to fit one line, including unreadable. Android largely ignores it. Bug is invisible on Android testing. **Default: prefer `numberOfLines={N}` and let the text wrap.** When the design genuinely requires one line on variable-length content (name tags, dynamic counts), use `adjustsFontSizeToFit` AND ALWAYS pair with `minimumFontScale={0.7}` (range `0.6`–`0.8`). Never use it bare. Always test on both platforms.
- **Large files to split carefully:** `contexts/AuthContext.tsx` (~830 LOC), `components/chat/ChatScreen.tsx` (~1350 LOC), `components/home/HomeScreen.tsx` (~300 LOC). Don't rewrite holistically; surgical edits only.
- **Do not replace the bottom nav.** `components/home/FloatingTabBar.tsx` is the final bottom nav for `(main)` screens. When porting prototype layouts that show a different/flat bottom nav, port the screen body only — leave the floating tab bar untouched.
- **AWS SigV4 in client** — `utils/sigv4.ts` signs Bedrock calls directly from the device. Known security issue (see Build & environment). Don't expand its surface.
- **Manual `android/` or `ios/` edits are wiped by `expo prebuild --clean`.** If you need to change native config, do it via a config plugin (see `plugins/with-android-light-theme.js`) or via `app.config.js`. Editing `styles.xml`, `AndroidManifest.xml`, or `Info.plist` directly will silently disappear on the next prebuild — this was the actual cause of the back-press dark flash never being permanently fixed in earlier sessions.

---

## Shipping discipline

- **Plan mode before implementation** on anything touching auth, onboarding flow, voice, or navigation — these have cross-cutting effects.
- **iOS + Android parity** — test both before claiming done. Android's elevation doesn't behave identically to iOS shadow; check dark mode too.
- **Golden path before edge cases** — get the happy flow on both platforms, then harden.
- **Don't introduce new dependencies without discussion** — the dep surface is already large. If you must add one, prefer Expo-managed or widely-used libs.
- **CI is fast and cheap** — `npm run typecheck && npm test` should take seconds. Run before pushing; fix red before asking for review.
- **Before deleting a file, grep the WHOLE repo, not just the local feature folder.** `grep -rn "FileName" --include='*.ts' --include='*.tsx'` from repo root. We almost shipped a build break by deleting `CrisisCheckSheet.tsx` from `components/onboarding/` without noticing it was still imported by `app/(main)/settings.tsx`. The TS check caught it; if it had been a runtime-only import (e.g. `require()` inside a hook), it would have crashed in production.

### What not to touch without asking

- **`/ios` and `/android` folders** — regenerated by `expo prebuild`. Manual edits get wiped (see landmines above). Use a config plugin instead.
- **`modules/audio/`** — custom Expo native module (Swift + Kotlin). Touching it requires a prebuild + native rebuild and risks breaking voice on one platform.
- **Auth-flow wiring** in `contexts/AuthContext.tsx`, `services/auth/*`, `lib/supabase.ts`, and `utils/onboardingStorage.ts` — these are load-bearing for both auth paths and the fresh-start guarantee. Surgical edits only, with explicit confirmation for anything beyond a typed-error fix.
- **`components/home/FloatingTabBar.tsx`** — the final bottom nav (also listed in landmines).
- **The config plugin** at `plugins/with-android-light-theme.js` — removing it from `app.config.js` re-introduces the back-press dark flash on the next prebuild. `npm run check:theme` will catch it.

---

## Slash commands & skills configured for this project

See `.claude/skills/` and `.claude/agents/`.

| Skill | When it applies |
|---|---|
| `mello-ui` | Legacy main-app UI work — enforces old Mello design tokens, fonts, gradients |
| `rn-feature` | Scaffolding a new feature folder under `components/` |
| `onboarding-screen` | Creating a new screen in `app/(onboarding)/` (uses BrandGlyphs tokens) |
| `rn-perf` | Jank, slow startup, re-render problems, FlashList tuning |
| `rn-a11y` | Screen-reader labels, hit targets, contrast |
| `eas-build` | EAS profile changes, env vars, build/submit issues |

| Agent | When to delegate |
|---|---|
| `rn-reviewer` | Post-implementation RN-specific code review |
| `ui-designer` | Planning a new screen's look/layout before coding |
| `perf-auditor` | Deep-dive investigation of a performance problem |

---

## Design references

**SelfMind (current onboarding) — Claude Design mockups**
Location: `/Users/warmachine37/Downloads/selfmind app design screens/`
Files: `mobile-styles.css` (the design tokens — keep BrandGlyphs.tsx in sync), `mobile-screens-onboarding.jsx`, `mobile-screens-onboarding-q.jsx` (the reference JSX for each screen, ported 1:1 to RN). When the user says "look at the new design for X," this is what they mean.

**Mello (legacy main-app) — Prototyping wireframes**
Location: `/Users/warmachine37/Desktop/mello prototyping/` (NOTE: space in folder name — quote when passing to shell)

When the user says "look at the prototype for X," **always read BOTH `screens.js` AND `annotations.js` for that screen id** — they're complementary:
- `js/screens.js` — visual spec (HTML strings per screen id)
- `js/annotations.js` — behavior spec (purpose, API calls, state, interactions, edge cases, a11y, voice-AI behavior)

Lookup protocol (parallel):
```
grep -n "id: '<screen-id>'"   "/Users/warmachine37/Desktop/mello prototyping/js/screens.js"
grep -n "'<screen-id>':"      "/Users/warmachine37/Desktop/mello prototyping/js/annotations.js"
```

Screen id prefixes: `onb-*`, `auth-*`, `home-main`, `voice-*`, `chat-*`, `journal-*`, `progress-*`, `crisis-*`, `profile-*`, `design-system`.

**Caveats when porting from prototype:**
- Prototype is HTML/CSS — port the visual intent (colors, type scale, spacing, shapes), not the class names.
- Prototype mentions Zustand, ElevenLabs, WatermelonDB, Razorpay — those are "planned / future." Don't introduce them now.

---

## External references

- [Expo 54 docs](https://docs.expo.dev/)
- [expo-router](https://docs.expo.dev/router/introduction/)
- [Reanimated v4](https://docs.swmansion.com/react-native-reanimated/)
- [FlashList](https://shopify.github.io/flash-list/)
- [LiveKit React Native](https://docs.livekit.io/reference/components/react-native/)
- [Hume EVI](https://dev.hume.ai/docs/empathic-voice-interface-evi/overview)

Last updated: 2026-04-28 (post-onboarding-redesign cleanup: schema migration, jest setup, CI, theme-check, ONBOARDING_FLOW.md)
