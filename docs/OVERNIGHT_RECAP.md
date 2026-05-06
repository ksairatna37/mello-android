# Overnight session recap — 2026-04-28

Session ended early per user request (permission-prompt friction was waking them up).
Resume tomorrow.

## ✅ Done tonight

### Folder rename: `(onboarding-new)` → `(onboarding)`

The "-new" suffix is gone. The active flow now lives in one place.

- Moved 14 files from `app/(onboarding-new)/` into `app/(onboarding)/`:
  - `_components/` (folder, all contents)
  - `analysing.tsx`
  - `credibility.tsx`
  - `emotional-mindwave.tsx` (kept as designated backup of your-reading)
  - `glow-transition.tsx`
  - `name-input.tsx`
  - `permissions.tsx`
  - `personalize-intro.tsx`
  - `questions.tsx`
  - `save-profile.tsx`
  - `verify-email.tsx`
  - `welcome-aboard.tsx`
  - `your-reading.tsx`
- Merged the two `_layout.tsx` files. The new `(onboarding)/_layout.tsx` registers welcome + the full chain in route order, plus `emotional-mindwave` as the backup.
- Bulk-rewrote all 34 references to `(onboarding-new)` → `(onboarding)` across:
  - 12 onboarding screen files
  - `contexts/AuthContext.tsx` (6 route strings)
  - `components/onboarding/AuthBottomSheet.tsx`
  - `services/onboarding/onboardingApi.ts` (comment)
  - `utils/onboardingStorage.ts` (comment)
- Removed the now-empty `app/(onboarding-new)/` directory.
- Updated header comment in `(onboarding)/_layout.tsx` to document the active route order.

### TS verification

- All paths resolve. `tsc --noEmit -p .` shows no NEW errors from the rename.
- The remaining errors in the codebase are all pre-existing (and were on the queue for tonight, but I didn't get to them):
  - `_components/DidYouKnow.tsx`: Reanimated `SharedValue` import
  - `glow-transition.tsx`: same `SharedValue` issue (3 lines)
  - `emotional-mindwave.tsx` (backup): `emotionalMaturity` field, `whatItMeans` missing, possible-null
  - `components/get-rolling/SimpleGradient.tsx`: `LinearGradient` colors readonly tuple
  - `components/get-rolling/TypingIndicator.tsx`: same SharedValue issue
  - `components/home/FeatureCardsDashboard.tsx`: `Svg.Circle` does not exist on type
  - `services/onboarding/onboardingApi.ts:185`: `emotionalMaturity` field reference
  - `components/voice/HindiVoiceScreen.tsx:223`: AudioSession `category` type
  - `modules/audio/src/AudioModule.ts:46`: never-type assignment
  - `contexts/AuthContext.tsx:304`: GoogleSignIn `nonce` ConfigureParams type

## 🚫 Stopped early — queued for tomorrow

These were all in the original overnight plan. None started.

1. **Disambiguate `completeOnboarding`** — rename the local-only one in `utils/onboardingStorage.ts` to `markOnboardingCompleteLocal`. Update no-op callers (the local one is barely used; the AuthContext one is canonical).

2. **Schema migration on `OnboardingData`** — drop legacy fields from the type (`moodWeather`, `emotionalMaturity`, `weakestDimension`, `spiritAnimal`, `lateNightMood`, `textToSelf*`, etc. — anything from the OLD flow). Add a `migrateOnboardingData()` function called once on app boot that strips those keys from any AsyncStorage payload that still has them. Cleans up the type AND any stale storage.

3. **Fix the 8 pre-existing TS errors listed above.** Most are 1–3-line fixes. The Reanimated `SharedValue` import issue probably needs `import type { SharedValue } from 'react-native-reanimated'` instead of the namespace path. The `LinearGradient` `colors` issue needs a tuple cast (`colors as readonly [ColorValue, ColorValue, ...ColorValue[]]`).

4. **Install jest-expo + write 10 high-leverage tests** (validator, deterministic profile, hasLocalOnboardingAnswers). The probe earlier showed an ERESOLVE peer-dep conflict on `jest-expo` — when you resume, install with `--legacy-peer-deps`, or fall back to plain `jest + ts-jest` (lighter footprint, equivalent for the validator/storage/routing unit tests we need).

5. **Add GitHub Actions CI** — one `ci.yml` running `tsc --noEmit` + `jest`. Plus `scripts/check-android-theme.mjs` to assert the post-prebuild `styles.xml` still has `Theme.AppCompat.Light.NoActionBar` and `windowBackground=@color/appCanvas` — guards the config plugin from accidental removal.

6. **Write `docs/ONBOARDING_FLOW.md`** — single source of truth diagramming: route chain, auth state machine, Bedrock validator contract, pinned-CTA exception list (auth forms), fresh-start rule. Future devs read this in 5 min instead of recovering it via grep.

## Tomorrow first move

Two suggestions before resuming:

1. **Run `/fewer-permission-prompts`** (a Claude Code skill that scans the transcript for common Bash patterns and adds them to project `.claude/settings.json`). This bakes in approval for the patterns we used tonight (`grep -rn`, `find...-exec sed`, `npx tsc`, etc.) so the next overnight session won't wake you. Takes 30 seconds.

2. **Pick the Jest path.** Options:
   - `jest-expo` (Expo's official, but had peer-dep conflict in our probe)
   - `jest + ts-jest` (lighter, no Expo coupling, easier to reason about)
   - Skip Jest, use Vitest (faster, but less RN ecosystem support)

   My recommendation: `jest + ts-jest` for now. The tests we need (validator, score derivation, routing logic) are pure-function unit tests — they don't need React Native renderer, just ts-jest to handle the TypeScript. Smaller footprint, no peer-dep fights, and you can always add `jest-expo` later when you start writing component tests.

## Working tree status

- No git commits made.
- All changes (file moves, route string rewrites, layout merge) sit in your working tree as `staged-but-not-committed` deletions of `app/(onboarding-new)/*` and `untracked` (or `modified`) versions in `app/(onboarding)/*`.
- `git status` will show ~15 deletions + ~14 new files + a few modified files. Visually big diff, but it's just the rename + the string updates.
- `git diff --stat` shows the whole picture. Review and commit at your pace tomorrow morning. Recommended commit message:
  ```
  refactor(onboarding): rename (onboarding-new) → (onboarding), merge layouts

  - Move 14 files into the unified (onboarding) folder
  - Merge welcome.tsx with the rest of the active flow
  - Rewrite 34 route-string references across screens, AuthContext, and helpers
  - No behavior change; routes are functionally identical
  ```

## What's STILL safe in the codebase (unchanged tonight)

- AuthContext routing logic
- Backend sync (`onboardingApi.ts`)
- Bedrock validator + deterministic fallback
- Glow-transition finalize pipeline
- Back-handler chains across all screens
- Pinned-footer CTA pattern (rule remains in memory)
- Android theme config plugin (still applies on prebuild)
- Index.tsx fresh-start rule (clears local data on launch when not completed)

Sleep well.
