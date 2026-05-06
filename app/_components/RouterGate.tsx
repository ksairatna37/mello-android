/**
 * RouterGate — single routing authority for the auth + onboarding flow.
 *
 * Responsibilities:
 *   1. Watch AuthState.
 *   2. Compute the desired pathname.
 *   3. If the desired pathname differs from the current pathname,
 *      `router.replace` exactly once.
 *
 * IMPORTANT: every pathname in this file — both what we compare against
 * and what we ship to `router.replace` — uses the PLAIN form
 * (`/welcome`, `/save-profile`, etc), no `(onboarding)` route-group
 * prefix. expo-router accepts both forms in `router.replace`, but
 * `usePathname()` returns the plain form. Comparing apples to apples
 * removes a class of infinite-loop bugs where stripping was off and
 * the gate kept re-routing to "the same" destination forever.
 *
 * Things this DOES NOT do:
 *   - Forward navigation triggered by a user action (clicking Continue,
 *     tapping a question option, etc.). Those stay in screen handlers.
 *   - Routing inside (main) — once a user is in the main app, they
 *     navigate freely until signOut.
 *
 * Decision matrix:
 *   loading      → no redirect (let the splash / current screen render)
 *   unauthed     → /welcome (unless already on a pre-auth onboarding path)
 *   pendingOtp   → /verify-email
 *   authed + onboarding_completed === true   → /home
 *   authed + onboarding_completed === false  → /credibility
 *   authed + profile null                    → /credibility
 *                                               (treat as "not completed";
 *                                                refreshProfile can recover)
 */

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Pathnames (the form usePathname returns — no route groups) ─── */

const ROUTE_WELCOME      = '/welcome';
const ROUTE_VERIFY_EMAIL = '/verify-email';
const ROUTE_MAIN         = '/home';
/**
 * Single canonical destination for any authed user whose onboarding
 * isn't yet complete. We deliberately do NOT derive a step from local
 * AsyncStorage answers — too easy for stale or partial data to land
 * the user mid-flow on /name-input or /personalize-intro and confuse
 * them. /credibility is the calm first step; the user walks the chain
 * from there. Local answers still persist in storage and the relevant
 * screens (personalize-intro, name-input) restore them when reached.
 */
const ROUTE_AUTHED_INCOMPLETE = '/credibility';

/**
 * Pathnames that count as "the onboarding flow" AND are valid for an
 * authed user with incomplete onboarding. The gate does not preempt
 * the user once they're on one of these — they own forward navigation.
 *
 * Excluded from this set on purpose:
 *   /welcome       — pre-auth landing only; an authed user has no
 *                    business there. Route them to the derived
 *                    onboarding step instead.
 *   /save-profile  — the sign-in / sign-up form; once signed in, route
 *                    them to the derived step
 *   /verify-email  — only valid during state.kind === 'pendingOtp';
 *                    an authed user should be moved off
 */
const POST_AUTH_ONBOARDING_PATHS = new Set<string>([
  '/credibility',
  '/personalize-intro',
  '/name-input',
  '/questions',
  '/analysing',
  '/your-reading',
  '/permissions',
  '/welcome-aboard',
]);

/**
 * Pathnames that count as "the onboarding flow" for any auth state.
 * Used by the unauthed branch to allow free navigation through the
 * pre-auth flow.
 */
const ANY_AUTH_ONBOARDING_PATHS = new Set<string>([
  '/welcome',
  '/credibility',
  '/personalize-intro',
  '/name-input',
  '/questions',
  '/analysing',
  '/your-reading',
  '/save-profile',
  '/verify-email',
  '/permissions',
  '/welcome-aboard',
]);

/**
 * Pathnames that count as "the main app." The gate does not redirect
 * authenticated users away from any of these (signOut state change
 * handles the unauth case).
 *
 * /change-password is included on purpose: it lives at the top-level
 * of /app (not under /(main)), but only authed users ever reach it.
 * Without this entry RouterGate would yank a logged-in user back to
 * /chat the moment they tap "Change password" in settings.
 */
const MAIN_PATHS = new Set<string>([
  '/chat',
  '/chats',
  '/chat-history',
  '/home',
  '/mood',
  '/mood-history',
  '/mood-detail',
  '/journal',
  '/journal-prompt',
  '/journal-entry',
  '/breathing',
  '/box-breath',
  '/box-breath-summary',
  '/box-breath-crisis-return',
  '/tell-someone',
  '/grounding',
  '/brain-dump',
  '/practice',
  '/reach-out',
  '/weekly',
  '/notifications',
  '/spaces',
  '/space',
  '/call',
  '/voice-active',
  '/voice-summary',
  '/voice-limit',
  '/profile',
  '/settings',
  '/change-password',
]);

function isInsideOnboardingForUnauthed(pathname: string): boolean {
  return ANY_AUTH_ONBOARDING_PATHS.has(pathname);
}

function isInsideOnboardingForAuthed(pathname: string): boolean {
  return POST_AUTH_ONBOARDING_PATHS.has(pathname);
}

function isInsideMainApp(pathname: string): boolean {
  return MAIN_PATHS.has(pathname) || pathname.startsWith('/chat');
}

/**
 * Compute the desired destination, or null to stay put.
 * Returns plain pathnames (no route-group prefix).
 */
function computeDestination(
  state: ReturnType<typeof useAuth>['state'],
  pathname: string,
): string | null {
  // Boot — wait for the auth listener to settle before deciding.
  if (state.kind === 'loading') return null;

  if (state.kind === 'unauthed') {
    if (isInsideOnboardingForUnauthed(pathname)) return null;
    return ROUTE_WELCOME;
  }

  if (state.kind === 'pendingOtp') {
    if (pathname === ROUTE_VERIFY_EMAIL) return null;
    return ROUTE_VERIFY_EMAIL;
  }

  // state.kind === 'authed'
  const completed = state.profile?.onboarding_completed === true;
  if (completed) {
    if (isInsideMainApp(pathname)) return null;
    return ROUTE_MAIN;
  }

  // Authed but onboarding NOT completed.
  if (isInsideOnboardingForAuthed(pathname)) return null;

  // /save-profile and /verify-email are auth screens that own their
  // own post-auth navigation. The flow is:
  //   1. Screen calls signInWithGoogle / verifyOtp.
  //   2. AuthState transitions to authed-incomplete.
  //   3. Screen calls router.replace(destination) synchronously after
  //      the auth await resolves.
  //
  // Step 2 triggers a re-render that runs RouterGate's effect BEFORE
  // step 3's pathname update propagates — so RouterGate sees the
  // user "authed-incomplete on /save-profile" with stale pathname and
  // (without this exception) fires a competing redirect to /credibility
  // that races and wins because it's queued after the screen's nav.
  // Trust the screen; it knows where the user belongs.
  //
  // If the screen's auth flow fails (caught error) the user stays on
  // the auth screen and can retry — which is the right behavior.
  if (pathname === '/save-profile' || pathname === ROUTE_VERIFY_EMAIL) {
    return null;
  }

  return ROUTE_AUTHED_INCOMPLETE;
}

export function RouterGate({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);

  /* Defensive guard against rapid re-renders. We only call
   * `router.replace` for a given destination once — if pathname hasn't
   * caught up but the gate fires again, we skip. The ref clears once
   * pathname matches what we last attempted, so a future legitimate
   * redirect to the same target (e.g. user navigates away then back)
   * isn't blocked. Without this, any subtle pathname-vs-destination
   * mismatch could spin React into "Maximum update depth exceeded." */
  const lastAttemptedRef = useRef<string | null>(null);

  // Compute desired destination whenever auth state or pathname changes.
  useEffect(() => {
    const dest = computeDestination(state, pathname);
    const stateLabel =
      state.kind === 'authed'
        ? `authed(completed=${state.profile?.onboarding_completed === true})`
        : state.kind;
    console.log(
      '[RouterGate] compute → state=',
      stateLabel,
      'pathname=',
      pathname,
      'dest=',
      dest ?? '(stay)',
    );
    // Only update state when the destination actually changes — prevents
    // unnecessary renders that could re-trigger the second effect.
    setPendingDestination((prev) => (prev === dest ? prev : dest));
  }, [state, pathname]);

  // Clear the "already attempted" ref once pathname has caught up. After
  // this clears, a future genuine redirect to the same target will fire
  // again (e.g. user navigates to /chat, then back to /, which should
  // re-route to /chat).
  useEffect(() => {
    if (lastAttemptedRef.current && lastAttemptedRef.current === pathname) {
      lastAttemptedRef.current = null;
    }
  }, [pathname]);

  // Apply the redirect when one is pending and pathname doesn't match.
  useEffect(() => {
    if (!pendingDestination) return;
    if (pendingDestination === pathname) return;
    if (lastAttemptedRef.current === pendingDestination) return;
    lastAttemptedRef.current = pendingDestination;
    console.log(
      '[RouterGate] FIRING router.replace →',
      pendingDestination,
      '(was on',
      pathname,
      ')',
    );
    router.replace(pendingDestination as any);
  }, [pendingDestination, pathname, router]);

  return <>{children}</>;
}

export default RouterGate;
