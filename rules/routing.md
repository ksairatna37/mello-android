# Routing & redirects

**Read this BEFORE: adding a new screen, changing back-handler logic, modifying RouterGate, adding any `router.push/replace/back` call, or wiring a redirect.**

The auth + onboarding flow has bitten us repeatedly with back-loops, ghost screens, and routing-direction mismatches. The rules below are the codified scar tissue from those incidents. Follow them exactly.

---

## 1. RouterGate is the single routing authority

`app/_components/RouterGate.tsx` is the ONLY file that decides where a user should go based on auth/profile state. Individual screens never inspect auth state to make routing decisions.

The current decision matrix:

| AuthState | Path constraint | Destination |
|---|---|---|
| `loading` | — | no redirect (wait) |
| `unauthed` | already on a pre-auth onboarding path | no redirect |
| `unauthed` | anywhere else | `/welcome` |
| `pendingOtp` | already on `/verify-email` | no redirect |
| `pendingOtp` | anywhere else | `/verify-email` |
| `authed` + `onboarding_completed === true` | inside `(main)` | no redirect |
| `authed` + `onboarding_completed === true` | anywhere else | `/chat` |
| `authed` + `onboarding_completed === false` | inside post-auth onboarding paths | no redirect |
| `authed` + `onboarding_completed === false` | anywhere else | `/credibility` |
| `authed` + `profile === null` | (treated as incomplete) | `/credibility` |

`POST_AUTH_ONBOARDING_PATHS` does NOT include `/welcome`, `/save-profile`, or `/verify-email`. Authed users on any of those get bounced to `/credibility`.

There is no derived-step logic. We do not read AsyncStorage to pick a "smart" resume point. Returning authed-incomplete users always restart from `/credibility`. Local answers persist and the relevant screens (personalize-intro, name-input) restore them when reached, but the routing decision is dumb and predictable.

---

## 2. NEVER auto-redirect from a screen on mount (ghost-screen rule)

This has burned us 3–4 times. Do not put `router.replace(...)` or `router.push(...)` inside a mount-time `useEffect` that runs on every visit.

When you do, the screen becomes a "ghost" — every time someone navigates to it, it forwards them somewhere else, and the back stack lies. Symptom: back from screen B routes to screen A (its parent), A immediately forwards to B again, user is trapped on B.

Concrete example we hit and ripped out — `name-input.tsx` used to do this:

```tsx
useEffect(() => {
  if (authProvider === 'google' && user) {
    router.replace('/(onboarding)/questions');  // ← ghost-screen
  }
}, [...]);
```

Hardware back from `/Q1` → `router.replace('/name-input')` → name-input mounts → silently redirects to `/questions` → user lands on Q1 again. Invisible loop, impossible to debug from the symptom alone.

**Rules:**

- Conditional behavior on a screen goes in **render** (return different JSX, pre-fill fields, hide sections, swap CTAs, render an empty header spacer instead of a back chevron). NOT in navigation.
- Cross-screen routing decisions go in **RouterGate**. Screens may only call `router.replace`/`router.push` in response to a user action (button tap, back press, form submit, OTP success).
- The single acceptable exception: a tightly-guarded **defensive redirect** for genuinely off-spec state. Example — `verify-email.tsx` redirects to `/welcome` only when `!pendingEmail && !verified && !isVerifying`. Comment why it's safe and guard it tightly so it can't fire on the happy path.
- When auditing, run `rg "useEffect" app/(onboarding)/ -B 2 -A 8 | rg -B 5 -A 2 "router\.(replace|push)"`. Every match needs a written justification.

---

## 3. Back-handler pattern in RouterGate-driven flows

Cold-boot resume can land a user mid-flow with no real back stack. `router.back()` is unsafe because `canGoBack()` can return true based on history that points at `/`, and back-popping to `/` re-runs RouterGate which routes the user back to the same screen → loop.

**The pattern:**

- **Back-handlers (hardware back AND header chevron) call `router.replace(parent)`**, never `router.back()`.
- **The stack sets `animationTypeForReplace: 'pop'`** so the replace animates as a slide-out-to-right (true back motion) instead of the default push slide-in-from-right.
- **Forward navigation uses `router.push`**, never `router.replace`, unless the destination must be unreachable via back. (Forward `router.replace` would also pick up the `pop` animation and look like a back step.)

When the forward destination would otherwise let the user pop back to a stale screen (e.g. `/permissions` → `/welcome-aboard`, where returning to `/permissions` after auth completion is meaningless), make the destination block hardware back via `useFocusEffect` + `BackHandler.addEventListener('hardwareBackPress', () => true)`. That keeps `push` safe without needing `replace`.

Applied in:
- `app/(onboarding)/_layout.tsx` — `animationTypeForReplace: 'pop'` on the stack screenOptions.
- Every onboarding screen back-handler — `router.replace(parent)`.
- Forward steps: `questions → analysing`, `analysing → your-reading`, `your-reading → save-profile / welcome-aboard`, `permissions → welcome-aboard` — all `router.push`.

---

## 4. Authed-incomplete users on `/credibility`

Returning signed-in-but-not-onboarded users land on `/credibility` (RouterGate's default). On this screen specifically:

- Hardware back **closes the app** (`BackHandler.exitApp()`). They have nowhere meaningful to go back to — `/welcome` is pre-auth-only and RouterGate would just bounce them right back.
- The on-screen back chevron is **hidden** (replaced with an empty spacer). Tapping it shouldn't close the app — that's a hardware-only gesture.

For unauthed users on `/credibility` (forward step from `/welcome`), back replaces to `/welcome` and the chevron is visible. Same screen, two behaviors keyed off `state.kind === 'authed' && state.profile?.onboarding_completed === false`.

---

## 5. Post-auth destination — owned by the auth screens, not RouterGate

**RouterGate exempts `/save-profile` and `/verify-email` from its authed-incomplete redirect** because those screens own their own post-auth navigation. Without the exemption, this race fires every time:

1. Screen awaits `signInWithGoogle()` / `verifyOtp()`.
2. AuthContext's listener flips the user to authed-incomplete (`setSigningIn(false)` + `setProfile`).
3. React renders. RouterGate's effect runs with the new auth state but the OLD pathname (`/save-profile`) — the navigation update from step 4 hasn't propagated yet.
4. Screen calls `router.replace(destination)` synchronously after the auth await resolves.
5. RouterGate's effect computes `/credibility` (default for authed-incomplete on a non-onboarding path) and fires its own `router.replace`.
6. Both navigations queue. Last write wins → user lands on `/credibility` instead of the screen's chosen destination.

Confirmed in logs: even though step 4 fires before step 5, the pathname read by RouterGate's effect is still `/save-profile` because navigation updates aren't synchronous. The exemption tells RouterGate "trust the screen here, don't fire a competing redirect." If the screen's auth flow errors, the user stays on the auth screen and can retry — which is the correct behavior.


RouterGate's authed-incomplete default is `/credibility` (the canonical first step). The auth screens (`save-profile.tsx`, `verify-email.tsx`) override this with a more specific destination by calling `router.replace` immediately after auth completes — the screen knows which entry path the user came from and whether they have local progress.

**Decision matrix:**

| Entry path / scenario | Post-auth destination | Why |
|---|---|---|
| `/save-profile?mode=signin` (welcome → "I already have account") + Google or email signin success | `/credibility` | Existing-account claim; user has no fresh local progress. RouterGate still overrides to `/chat` if their server profile is fully onboarded. |
| `/save-profile` default mode (signup from `/your-reading`) + Google success + finished pre-auth chain | `/permissions` | User walked the chain; jump them ahead instead of restarting. |
| `/save-profile` default mode + Google success + did NOT finish pre-auth chain | `/credibility` | Defensive — somehow reached signup without local progress. |
| `/verify-email` after OTP success + finished pre-auth chain | `/permissions` | Email signup completion of the same flow. |
| `/verify-email` after OTP success + did NOT finish pre-auth chain | `/credibility` | Catches the autopromote case (signin entry → no account → transparent signup → OTP). |

**The "finished pre-auth chain" check** is a single binary signal — `firstName && personalizeTopics.length > 0 && qBringHere`. Inlined in `save-profile.tsx` (`hasFinishedPreAuthChain()`) and duplicated in `verify-email.tsx`. Do NOT re-introduce a `deriveOnboardingStep`-style "smart resume" utility. That pattern landed users on `/name-input` or `/personalize-intro` from stale AsyncStorage and was deliberately deleted.

**The autopromote-to-signup case** (typed credentials, no account, transparently signed up) is handled correctly by both screens: it goes through `pendingOtp` → `/verify-email`, and verify-email's progress check returns false (autopromoted user has no local progress), routing to `/credibility`.

Manual `router.replace` from these screens beats RouterGate's default because RouterGate doesn't preempt users who are already on a path inside `POST_AUTH_ONBOARDING_PATHS` (which includes `/permissions` and `/credibility`).

---

## 6. Stack transition timing — target ~850 ms

Every stack `_layout.tsx` uses:

```tsx
<Stack
  screenOptions={{
    headerShown: false,
    animation: 'slide_from_right',
    gestureEnabled: true,
    contentStyle: { backgroundColor: '#FBF5EE' },
    animationTypeForReplace: 'pop',
  }}
/>
```

**Timing:** ~850ms — the "smooth slow" feel tuned on welcome → credibility. On Android this maps to the platform default for `slide_from_right` (no explicit `animationDuration`). Rejected values: 420ms (snappy/fast), 600ms (still fast). Accepted: system default.

**Known trade-off:** Android `slide_from_right` renders a system-level dim scrim over the outgoing card. Not JS-configurable. `ios_from_right` avoids the dim but runs ~350ms and no override matched 850ms. If the dim becomes a blocker, the fix is a custom Reanimated transition — not patching `contentStyle` (ineffective) or `cardOverlayEnabled: false` (JS-Stack-only, native-stack ignores it).

---

## 7. Per-screen overrides

- `questions` screen sets `gestureEnabled: false`. The pager owns its own back behavior (Q9 → Q8 → … → Q1 via internal `setPage`). Leaving the OS swipe-back gesture enabled would let an iOS edge-swipe pop the entire `/questions` screen straight to `/name-input`, skipping every answered question.

## 7a. Onboarding finalize lives on /welcome-aboard

`completeOnboarding()` is called inline by `/welcome-aboard`'s CTAs. While the call is in flight, the user sits on `/welcome-aboard` (which is in `POST_AUTH_ONBOARDING_PATHS`, so RouterGate doesn't preempt). When the PATCH succeeds, `profile.onboarding_completed` flips, AuthState becomes authed-complete, and RouterGate routes the user to `/chat` automatically — no manual `router.replace` needed.

If a future flow needs a long-running screen that spans the onboarding-incomplete → onboarding-complete auth transition, add the path to BOTH `POST_AUTH_ONBOARDING_PATHS` (so authed-incomplete users aren't preempted while the work is in flight) AND `MAIN_PATHS` (so authed-complete users aren't yanked off the moment the flag flips). The earlier `/glow-transition` screen used this pattern; it's been removed but the trap is documented here in case the pattern resurfaces.

---

## 8. Path constants — always use the plain form

`usePathname()` returns paths in the plain form (`/welcome`, `/credibility`), no `(onboarding)` route-group prefix. RouterGate compares against and ships plain forms exclusively. Mixing the two introduces a class of "infinite loop" bugs where stripping was off and the gate kept re-routing to "the same" destination forever.

`router.replace` and `router.push` accept either form. Prefer the route-group form in screen calls (`/(onboarding)/credibility`) for clarity, but never compare against `usePathname()` output without normalizing.

---

## Checklist before merging routing changes

- [ ] No new mount-time `router.replace` or `router.push` inside `useEffect` (ghost-screen rule). If you absolutely need one, write a comment explaining why it can't fire on the happy path.
- [ ] Forward navigation uses `router.push` unless the destination must be unreachable via back.
- [ ] Back-handlers (hardware AND chevron) use `router.replace(parent)`, not `router.back()`.
- [ ] If a new screen is added to `(onboarding)`, decide whether it belongs in `POST_AUTH_ONBOARDING_PATHS` and update RouterGate accordingly.
- [ ] If a new path is added to `(main)`, add it to `MAIN_PATHS` in RouterGate.
- [ ] Cross-screen routing decisions (e.g. "if X, go to Y") live in RouterGate, not in the screen.
- [ ] Stack screenOptions for any new flow include `animationTypeForReplace: 'pop'`.
- [ ] Tested on Android hardware back AND iOS edge-swipe.
