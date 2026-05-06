# Onboarding flow

Single source of truth for how the SelfMind onboarding works in this
codebase. Read this before touching anything in `app/(onboarding)/`,
`contexts/AuthContext.tsx`, `services/chat/bedrockService.ts`, or
`utils/onboardingStorage.ts`.

If reality drifts from what's written here, fix the doc *or* fix the
code — don't let the two diverge silently.

---

## 1. Route chain

The full active sequence, in order:

```
welcome
  → credibility
  → personalize-intro
  → name-input
  → questions          (10-question pager)
  → analysing          (gate: validator passes or fallback)
  → your-reading
  → save-profile       (auth: email/password or Google)
  → verify-email       (only on email path)
  → permissions
  → welcome-aboard
  → glow-transition    (fade animation, finalizes backend sync)
  → /(main)/home
```

Registered in `app/(onboarding)/_layout.tsx`. The Stack uses
`animation: 'slide_from_right'` everywhere except glow-transition
which uses `'fade'` so the welcome card dissolves into the bloom.

`emotional-mindwave` is **not** in the active flow. It used to live
as a backup of `your-reading`; deleted on 2026-04-28. Recoverable from
branch `feat/onboarding-revamp` (commit `0e36d7a`).

---

## 2. Routing rules (entry + auth)

Defined in `app/index.tsx` and `contexts/AuthContext.tsx`.

### Fresh-start guarantee

Until onboarding is fully complete, **every fresh app launch routes
to `/welcome` and wipes any partial local onboarding answers**.

```
no session                              → wipe local data → /welcome
authenticated, onboarding_completed     → /(main)/chat
authenticated, NOT onboarding_completed → wipe local data → /welcome
```

Implemented at [`app/index.tsx`](../app/index.tsx). The wipe is
`clearOnboardingData()`. The auth session is **not** touched — a
user mid-onboarding stays signed in (their backend profile already
exists with `onboarding_completed=false`); they just re-enter
answers from scratch.

Reason: resume-from-mid-flow felt jumpy AND surfaced stale state.
Both unacceptable for mental-health onboarding.

### Post-auth routing

After save-profile / verify-email completes auth, the app needs to
decide: send the user forward (→ permissions → welcome-aboard), or
back to credibility for a re-do?

`hasLocalOnboardingAnswers()` in
[`utils/onboardingProgress.ts`](../utils/onboardingProgress.ts) is
the gate. Returns true if any of these have been answered:

- `firstName` (name-input)
- `qBringHere`, `qHardestTime`, `qInnerVoice` (questions)
- `emotionalBattery` (Q5)
- `personalizeTopics` (personalize-intro)

If true → forward. If false → re-do.

Pure function, unit-tested in
[`__tests__/onboardingProgress.test.ts`](../__tests__/onboardingProgress.test.ts).

---

## 3. Emotional profile validator

The reading shown on `your-reading.tsx` is gated by
`validateProfile()` in
[`services/chat/bedrockService.ts`](../services/chat/bedrockService.ts).

This is mental-health-grade output. The contract is conservative:
**we'd rather show the soft analysing fallback than a misleading
number.** Five rejection / override branches:

1. **Missing or non-numeric scores** → reject (return null). UI
   falls back. We do **not** backfill missing scores with a
   "neutral" default.
2. **Score collapse (range < 5)** → reject. Means the model
   returned "everything is roughly the same," almost always a
   fallback to its own example output.
3. **Scores match prompt example verbatim** (72/55/64/58/61) →
   reject. The model copied the example instead of scoring.
4. **`whatItMeans` doesn't reference the actual strongest dim** →
   override with a deterministic template derived from the scores.
5. **`interpretation` lauds a low-scoring dim** (e.g. calls
   `your calm` a "foundation" when calm = 25) → override with
   fallback. Threshold is 40.

Every override is logged. Tested in
[`__tests__/validateProfile.test.ts`](../__tests__/validateProfile.test.ts).

### Last-resort fallback

If Bedrock fails twice, `composeDeterministicProfile()` builds a
profile from the user's own answers via heuristic offsets from a 50
baseline. Clamped into `[5, 95]` so we never display 0 or 100 from
heuristics. Tested directionally in
[`__tests__/composeDeterministicProfile.test.ts`](../__tests__/composeDeterministicProfile.test.ts).

The analysing screen (`app/(onboarding)/analysing.tsx`) owns this
gate: poll cache → retry at temp 0.6 → deterministic fallback →
save → reveal Continue button.

---

## 4. Pinned-footer CTA pattern

Onboarding primary CTAs **must pin at the bottom** of the screen,
outside any ScrollView. Keeps the action discoverable without
forcing the user to scroll.

```jsx
<View style={styles.container}>
  <ScrollView contentContainerStyle={...}>
    {/* content */}
  </ScrollView>
  <View style={styles.footer}>
    <PrimaryButton ... />
  </View>
</View>
```

### Exceptions (CTA inline by design)

- **save-profile.tsx** — the "Continue with Google" / submit
  button is the form action; pinning would split the form across
  the screen.
- **verify-email.tsx** — same; the OTP input + submit form a unit.

---

## 5. Back-press dark flash fix

Four-layer remedy across native theme + JS layouts. If you see a
dark gradient flash during back transitions, one of these has been
removed.

1. **Config plugin** —
   [`plugins/with-android-light-theme.js`](../plugins/with-android-light-theme.js)
   forces `AppTheme` to `Theme.AppCompat.Light.NoActionBar`, sets
   `windowBackground=@color/appCanvas`, `forceDarkAllowed=false`.
   Re-applied on every prebuild (otherwise `prebuild --clean` wipes
   manual `styles.xml` edits).
2. **Predictive-back disable** — same plugin sets
   `enableOnBackInvokedCallback="false"` on the Android
   `<application>` tag. Without this, Android 14 paints a dim scrim
   over the outgoing screen during back transitions.
3. **`contentStyle` on every Stack layout** —
   `{ backgroundColor: '#FBF5EE' }` in every nested `_layout.tsx`
   so the React Navigation transition canvas is always cream.
4. **ScrollFadeEdges overlay (not MaskedView)** —
   [`components/get-rolling/ScrollFadeEdges.tsx`](../components/get-rolling/ScrollFadeEdges.tsx)
   uses two absolute LinearGradients painting `bg → transparent`,
   not native masking. MaskedView bleeds dark on Android transitions.
   See the file's header comment for the full v1 → v2 history.

`scripts/check-android-theme.mjs` (run via `npm run check:theme`)
asserts layers 1+2 still apply post-prebuild.

---

## 6. Schema policy

[`utils/onboardingStorage.ts`](../utils/onboardingStorage.ts) is the
**single source of truth** for what the onboarding flow may persist
locally. The `OnboardingData` type only contains active fields.

Legacy fields from the pre-redesign "get-rolling" flow are stripped
on boot via `migrateOnboardingData()`, called once from the root
layout. The function is idempotent and safe to re-run.

If you add a new field to the flow:
- Add it to the `OnboardingData` type.
- Make sure it appears in `hasMeaningfulOnboardingAnswers` if it's
  a pre-auth signal.
- If it should be sent to backend, add a branch in
  `buildPreferences()` in
  [`services/onboarding/onboardingApi.ts`](../services/onboarding/onboardingApi.ts).

If you remove a field:
- Remove from the type.
- Add the key string to `LEGACY_KEYS` in `migrateOnboardingData`
  so existing payloads get cleaned.

---

## 7. Local development

```sh
npm run typecheck     # tsc --noEmit -p .
npm test              # jest unit tests (validators + progress helper)
npm run check:theme   # post-prebuild Android theme assertion
```

CI runs typecheck + tests on every push and PR
([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).
Native build lives in EAS, not GitHub Actions.
