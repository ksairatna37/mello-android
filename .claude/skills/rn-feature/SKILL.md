---
name: rn-feature
description: Scaffold a new feature in the Mello React Native app. Apply when the user says "create a feature", "add a new feature", "scaffold X feature", or starts building a cohesive unit (screens + components + service + types). Generates the feature folder inside components/, wires routes in app/, and follows Mello conventions for expo-router, AuthContext, and the design tokens in constants/.
---

# rn-feature skill — scaffold a new feature in Mello

Use when starting a new feature. A "feature" in Mello is a vertical slice: one or more screens + its components + a service (if it hits the backend) + types + storage.

## Mello's feature pattern (observed in the codebase)

```
components/<feature>/
  <Feature>Screen.tsx         # main screen (PascalCase)
  <Feature>Sidebar.tsx        # secondary surfaces if any
  <SmallComponent>.tsx        # feature-private components
services/<feature>/
  <feature>Api.ts             # REST calls via api/client.ts
  <feature>Storage.ts         # AsyncStorage helpers (if persisted)
  <feature>Service.ts         # orchestration / business logic
utils/<feature>Store.ts       # optional vanilla pub/sub store for UI toggles
app/(main)/<feature>.tsx      # expo-router entry (if feature is a tab/screen)
```

## Steps when scaffolding

1. **Confirm feature name** with the user (kebab-case folder; PascalCase component prefix).

2. **Choose the route group** — does this live in `(main)` (tab-bar), `(onboarding-new)` (onboarding flow), or `(auth)`? Ask if unsure.

3. **Create the feature folder under `components/<feature>/`** — one main `<Feature>Screen.tsx` plus feature-private components.

4. **Apply the standard screen scaffold** from the `mello-ui` skill — `MelloGradient`, `useSafeAreaInsets`, `StatusBar`, `StyleSheet.create`. Use `Pressable` + tokens from `constants/`.

5. **Wire the route** — add `app/(main)/<feature>.tsx` that re-exports the screen:
   ```tsx
   export { default } from '@/components/<feature>/<Feature>Screen';
   ```
   If the feature needs its own subflow, make a folder with `_layout.tsx`.

6. **Gate on auth where needed** — import `useAuth()` from `@/contexts/AuthContext`. Prefer pushing the auth check up to `app/index.tsx` or a layout rather than scattering `if (!user) router.replace(...)`.

7. **Add a service layer ONLY if the feature talks to the backend** — don't create empty `services/<feature>/` folders.
   - Use helpers from `api/client.ts` (`get`, `post`, `authGet`, `authPost`, `authPatch`).
   - Declare endpoints in `api/endpoints.ts` — do not hardcode URLs.
   - Error-parse using the conventions in existing services.

8. **Persist user data** via AsyncStorage helpers in `utils/` (see `utils/onboardingStorage.ts` as the template). Keep a typed data shape + `get`, `update`, `reset` functions.

9. **Add a vanilla pub/sub store ONLY for cross-cutting UI toggles** (fullscreen, sidebar-visible). Otherwise prefer local `useState` or `AuthContext`.

10. **Don't add tests yet** — there's no test framework wired up. Flag this as future work if tests would make sense.

## Example invocation

User: "Scaffold a `moodInsights` feature with one screen that shows mood history in a chart."

- `components/moodInsights/MoodInsightsScreen.tsx` — uses `MelloGradient`, safe area, heading "Mood insights" in `Outfit-Bold 34/40`, placeholder for chart.
- `services/moodInsights/moodInsightsApi.ts` — `getMoodHistory()` hitting `/rest/v1/mood_checkins` via `authGet`.
- `app/(main)/mood-insights.tsx` — `export { default } from '@/components/moodInsights/MoodInsightsScreen';`
- No store, no storage helper — data is fetched on mount.

## Guardrails

- Don't create folders you won't populate today — empty scaffolds rot.
- Don't invent design tokens — pull from `constants/`.
- Don't introduce Redux/Zustand; use the patterns above.
- Don't hardcode backend URLs; they belong in `api/endpoints.ts`.
- Before adding a new env var, read `.claude/skills/eas-build` — vars must flow through `app.config.js` → `config/env.ts`.
