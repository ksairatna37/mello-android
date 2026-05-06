/**
 * SelfMindProfile — profile + settings surface (PROFILE tab).
 *
 * Port of MBSettings in mobile-screens-b.jsx. The design merges what
 * was previously two screens (profile + settings) into a single tab.
 *
 * Wired to backend (per docs/BACKEND_API.md):
 *   - `state.profile` is the response of `GET /rest/v1/profiles?id=…`
 *     (AuthContext fetches and caches it). We display:
 *       · `profile.username`  → display name (falls back to local
 *                                onboarding firstName, then email
 *                                prefix, then "friend")
 *       · `profile.email_id`  → email row + identity subline
 *       · `profile.created_at`→ "since {Mon YYYY}" subline
 *   - Sign Out wired to AuthContext.signOut() with a confirmation
 *     dialog. Routing back to /welcome is owned by RouterGate (it
 *     fires when AuthState transitions to 'unauthed').
 *
 * Settings sections (Companion / Privacy / Subscription) still ship
 * with the design's static rows for now — they'll be backed by
 * `mello_user_preferences` (PATCH /rest/v1/profiles) when each row's
 * edit flow is wired. Tapping a row is a no-op today; the tap target
 * sits ready for a future modal.
 */

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { useAuth } from '@/contexts/AuthContext';
import { getOnboardingData, setOnboardingData } from '@/utils/onboardingStorage';
import {
  getProfilePreferences,
  getProfilePreferencesSync,
  hydrateProfilePreferencesFromServer,
  subscribeProfilePreferences,
  updateProfilePreferences,
  PRONOUNS_OPTIONS,
  AGE_RANGE_OPTIONS,
  VOICE_OPTIONS,
  THERAPIST_STYLE_OPTIONS,
  CHECK_IN_TIME_OPTIONS,
  labelForPronouns,
  labelForAgeRange,
  labelForVoice,
  labelForTherapistStyle,
  labelForMemory,
  labelForCheckInTimes,
  type Pronouns,
  type AgeRange,
  type VoicePref,
  type TherapistStyle,
  type ProfilePreferences,
} from '@/utils/profilePreferences';
import {
  updateUsernameRemote,
  updateMelloUserPreferencesRemote,
} from '@/services/profile/profileSettingsApi';
import RadioSheet from '@/components/profile/sheets/RadioSheet';
import EditNameSheet from '@/components/profile/sheets/EditNameSheet';
import CheckInTimesSheet from '@/components/profile/sheets/CheckInTimesSheet';
import DeleteAccountSheet from '@/components/profile/sheets/DeleteAccountSheet';
import SignOutBottomSheet from '@/components/settings/SignOutBottomSheet';
import { deleteAccountRemote } from '@/services/auth/deleteAccountApi';


/* ─── Section data ─────────────────────────────────────────────────
 *
 * Editable rows now accept an `onPress` that opens the matching sheet
 * (see `activeSheet` state). Email and the static settings sections
 * stay read-only — `onPress: null` renders without a chevron and
 * doesn't trigger a tap. Static rows (Privacy, Subscription) keep the
 * existing UI shape but no editing logic; they're the next surface to
 * wire up. */

type Row = {
  label: string;
  value?: string;
  /** null = read-only / display only (no chevron, no tap). */
  onPress: (() => void) | null;
  danger?: boolean;
};
type Section = { title: string; rows: Row[] };

/* "since {Mon YYYY}" formatter — handles ISO timestamps and undefined. */
function formatSince(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `since ${d.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toLowerCase()}`;
}

/* ─── Screen ──────────────────────────────────────────────────────── */

type SheetId =
  | 'name'
  | 'pronouns'
  | 'age'
  | 'voice'
  | 'memory'
  | 'checkin'
  | 'therapist';

export default function SelfMindProfile() {
  const insets = useSafeAreaInsets();
  const { state, signOut, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSheet, setActiveSheet] = useState<SheetId | null>(null);
  const [signOutSheetOpen, setSignOutSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* Live-subscribe to local profile preferences. The cache is populated
   * by `getProfilePreferences()` on first read; we trigger the read on
   * mount via the hydration effect below. */
  const prefs = useSyncExternalStore<ProfilePreferences | null>(
    subscribeProfilePreferences,
    getProfilePreferencesSync,
  ) ?? {};

  const handleRefresh = useCallback(async () => {
    console.log('[Profile] pull-to-refresh');
    setRefreshing(true);
    try {
      await Promise.all([
        refreshProfile().catch(() => {}),
        getOnboardingData().then((d) => { if (d.firstName) setFirstName(d.firstName); }).catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile]);

  // First-mount hydration: read local cache, then overlay anything
  // newer from the server profile so a fresh device picks up the
  // user's saved settings.
  useEffect(() => {
    let cancelled = false;
    getOnboardingData()
      .then((d) => { if (!cancelled && d.firstName) setFirstName(d.firstName); })
      .catch(() => {});
    void getProfilePreferences();
    return () => { cancelled = true; };
  }, []);

  const profile = state.kind === 'authed' ? state.profile : null;
  const serverPrefs = profile?.mello_user_preferences ?? null;
  // Hydrate from server whenever the profile mello_user_preferences
  // changes (e.g. just-completed refreshProfile or initial fetch).
  useEffect(() => {
    if (!serverPrefs) return;
    void hydrateProfilePreferencesFromServer(serverPrefs);
  }, [serverPrefs]);
  const userEmail =
    profile?.email_id ?? (state.kind === 'authed' ? state.email : '');
  // Display name priority: server username → local firstName (set during
  // onboarding) → email prefix → 'friend'. Server username takes
  // precedence so a deliberate edit on the backend wins over stale local.
  const displayName =
    profile?.username || firstName || (userEmail ? userEmail.split('@')[0] : 'friend');
  const since = useMemo(() => formatSince(profile?.created_at), [profile?.created_at]);

  /* ─── Row save handlers — optimistic local + best-effort PATCH ─── */

  const closeSheet = useCallback(() => setActiveSheet(null), []);

  const handleNameSave = useCallback(async (next: string) => {
    setActiveSheet(null);
    // Capture the pre-edit value so we can revert if the server PATCH
    // fails — silent revert on the next refreshProfile is a worse UX
    // than visible "didn't save" feedback right now.
    const prev = firstName;
    setFirstName(next);
    void setOnboardingData({ firstName: next });
    void updateUsernameRemote(next).then((ok) => {
      if (ok) {
        void refreshProfile();
      } else {
        // Roll back local state + onboarding mirror so the row snaps
        // back to the user's previous name. They'll see the change
        // didn't take.
        setFirstName(prev);
        void setOnboardingData({ firstName: prev || undefined });
      }
    });
  }, [refreshProfile, firstName]);

  const persistPrefsPatch = useCallback(async (patch: Partial<ProfilePreferences>) => {
    // Snapshot pre-state for failure revert. The patch keys are what
    // we need to undo if the server rejects the write.
    const before = await getProfilePreferences();
    const undoKeys = Object.keys(patch) as (keyof ProfilePreferences)[];
    const undo: Partial<ProfilePreferences> = {};
    for (const k of undoKeys) {
      // Cast: `before[k]` is the pre-edit value, type-correct by key.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (undo as any)[k] = (before as any)[k];
    }
    await updateProfilePreferences(patch);
    const merged = await getProfilePreferences();
    const ok = await updateMelloUserPreferencesRemote(merged);
    if (!ok) {
      // Server rejected — revert local cache so the row snaps back.
      await updateProfilePreferences(undo);
    }
  }, []);

  const handlePronounsSave = useCallback((key: Pronouns) => {
    setActiveSheet(null);
    void persistPrefsPatch({ pronouns: key });
  }, [persistPrefsPatch]);

  const handleAgeSave = useCallback((key: AgeRange) => {
    setActiveSheet(null);
    void persistPrefsPatch({ age_range: key });
  }, [persistPrefsPatch]);

  const handleVoiceSave = useCallback((key: VoicePref) => {
    setActiveSheet(null);
    void persistPrefsPatch({ voice: key });
  }, [persistPrefsPatch]);

  const handleMemorySave = useCallback((key: 'on' | 'off') => {
    setActiveSheet(null);
    void persistPrefsPatch({ memory_enabled: key === 'on' });
  }, [persistPrefsPatch]);

  const handleTherapistStyleSave = useCallback((key: TherapistStyle) => {
    setActiveSheet(null);
    void persistPrefsPatch({ therapist_style: key });
  }, [persistPrefsPatch]);

  const handleCheckInTimesSave = useCallback((next: ReadonlyArray<string>) => {
    setActiveSheet(null);
    void persistPrefsPatch({ check_in_times: next });
  }, [persistPrefsPatch]);

  /* These handlers are referenced by `sections` below — declare them
   * BEFORE the `useMemo` so the deps array doesn't read them inside
   * the temporal dead zone (would crash with
   * "Cannot access 'handleDeleteAccountPress' before initialization"
   * on first render). */
  const handleSignOutPress = useCallback(() => {
    if (signingOut) return;
    setSignOutSheetOpen(true);
  }, [signingOut]);

  const handleDeleteAccountPress = useCallback(() => {
    if (deletingAccount) return;
    setDeleteError(null);
    setDeleteSheetOpen(true);
  }, [deletingAccount]);

  const handleDeleteAccountConfirm = useCallback(async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const res = await deleteAccountRemote();
      if (!res.ok) {
        setDeleteError(res.message ?? 'Could not delete your account. Please try again.');
        setDeletingAccount(false);
        return;
      }
      // Server confirmed deletion — sign out locally so AuthContext
      // wipes every local cache (practice, sound spaces, profile
      // prefs, chat memory, onboarding) and RouterGate routes to
      // /welcome on the AuthState transition. Do NOT manually close
      // the sheet first — keeping the loading spinner visible until
      // signOut completes prevents a "sheet vanishes mid-await" frame
      // and gives the user an unbroken visual until RouterGate yanks
      // the screen.
      await signOut();
    } catch (err) {
      console.error('[SelfMindProfile] deleteAccount error:', err);
      setDeleteError('Something went wrong. Please try again.');
      setDeletingAccount(false);
    }
  }, [deletingAccount, signOut]);

  const handleSignOutConfirm = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      // RouterGate handles the route to /welcome on AuthState
      // transition; nothing else to do here.
    } catch (err) {
      console.error('[SelfMindProfile] signOut error:', err);
    } finally {
      setSigningOut(false);
      setSignOutSheetOpen(false);
    }
  }, [signingOut, signOut]);

  const sections: ReadonlyArray<Section> = useMemo(() => [
    {
      title: 'Profile',
      rows: [
        { label: 'Name',     value: profile?.username || firstName || 'Add', onPress: () => setActiveSheet('name') },
        { label: 'Email',    value: userEmail || '—', onPress: null },
        { label: 'Pronouns', value: labelForPronouns(prefs.pronouns), onPress: () => setActiveSheet('pronouns') },
        { label: 'Age',      value: labelForAgeRange(prefs.age_range), onPress: () => setActiveSheet('age') },
      ],
    },
    {
      title: 'The companion',
      rows: [
        { label: 'Voice',           value: labelForVoice(prefs.voice), onPress: () => setActiveSheet('voice') },
        { label: 'Memory',          value: labelForMemory(prefs.memory_enabled), onPress: () => setActiveSheet('memory') },
        { label: 'Check-in times',  value: labelForCheckInTimes(prefs.check_in_times), onPress: () => setActiveSheet('checkin') },
        { label: 'Therapist style', value: labelForTherapistStyle(prefs.therapist_style), onPress: () => setActiveSheet('therapist') },
      ],
    },
    {
      title: 'Privacy',
      rows: [
        { label: 'Encryption',      value: 'end-to-end', onPress: null },
        { label: 'Crisis contacts', value: '0 added',    onPress: null },
        { label: 'Delete account',  danger: true,         onPress: handleDeleteAccountPress },
      ],
    },
    {
      title: 'Subscription',
      rows: [
        { label: 'SelfMind Plus', value: 'Free plan', onPress: null },
      ],
    },
  ], [profile?.username, firstName, userEmail, prefs, handleDeleteAccountPress]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar — title + back chevron not shown on the tab-mounted
          version; design has back/right ellipsis, but the tab surface
          doesn't navigate "back" anywhere meaningful. Keep it minimal. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topSide} />
        <Text style={styles.title}>Settings</Text>
        <View style={styles.topSide} />
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 140 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.ink2}
              colors={[C.coral]}
              progressBackgroundColor={C.paper}
            />
          }
        >
          {/* Identity header — name + "since {Mon YYYY}" subline mirrors
              the design's "92 sessions · since jan" pattern, but using
              profile.created_at as the only ground-truth metric we have
              today. Session count goes in once a counter endpoint exists. */}
          <View style={styles.identity}>
            <Image
              source={require('@/assets/orb-v2.png')}
              style={{ width: 64, height: 64 }}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.subline}>
                {since || userEmail || 'no email on file'}
              </Text>
            </View>
          </View>

          {/* Sections */}
          <View style={styles.sections}>
            {sections.map((s) => (
              <View key={s.title}>
                <Text style={styles.sectionKicker}>{s.title.toUpperCase()}</Text>
                <View style={styles.sectionCard}>
                  {s.rows.map((row, j) => {
                    const isLast = j === s.rows.length - 1;
                    const tappable = row.onPress != null;
                    return (
                      <TouchableOpacity
                        key={`${s.title}-${row.label}`}
                        style={[styles.row, !isLast && styles.rowDivider]}
                        activeOpacity={tappable ? 0.7 : 1}
                        disabled={!tappable}
                        onPress={tappable ? row.onPress! : undefined}
                      >
                        <Text
                          style={[
                            styles.rowLabel,
                            row.danger && styles.rowLabelDanger,
                          ]}
                        >
                          {row.label}
                        </Text>
                        <View style={styles.rowRight}>
                          {!!row.value && (
                            <Text style={styles.rowValue}>{row.value}</Text>
                          )}
                          {tappable && <Glyphs.Arrow size={12} color={C.ink3} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Sign out */}
            <TouchableOpacity
              style={[styles.signOutBtn, signingOut && styles.signOutBtnDim]}
              onPress={handleSignOutPress}
              disabled={signingOut}
              activeOpacity={0.85}
            >
              {signingOut ? (
                <ActivityIndicator size="small" color={C.coral} />
              ) : (
                <Text style={styles.signOutText}>Sign out</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>SELFMIND · v0.1 · selfmind.app</Text>
        </ScrollView>
      </FadingScrollWrapper>

      {/* Edit sheets — always mounted; `visible` controls show/hide so
       *  the close animation can run. Only one is ever visible at a time
       *  via the `activeSheet` enum. */}
      <EditNameSheet
        visible={activeSheet === 'name'}
        initialValue={profile?.username || firstName || ''}
        title="Your name"
        caption="This is how the room greets you."
        onSave={handleNameSave}
        onClose={closeSheet}
      />
      <RadioSheet
        visible={activeSheet === 'pronouns'}
        kicker="— pronouns"
        title="How should we refer to you?"
        options={PRONOUNS_OPTIONS}
        selected={prefs.pronouns}
        onSelect={handlePronounsSave}
        onClose={closeSheet}
      />
      <RadioSheet
        visible={activeSheet === 'age'}
        kicker="— age"
        title="What's your age range?"
        options={AGE_RANGE_OPTIONS}
        selected={prefs.age_range}
        onSelect={handleAgeSave}
        onClose={closeSheet}
      />
      <RadioSheet
        visible={activeSheet === 'voice'}
        kicker="— voice"
        title="Which language should I speak?"
        options={VOICE_OPTIONS}
        selected={prefs.voice}
        onSelect={handleVoiceSave}
        onClose={closeSheet}
      />
      <RadioSheet
        visible={activeSheet === 'memory'}
        kicker="— memory"
        title="Should I remember you?"
        options={[
          { key: 'on',  label: 'On',  hint: 'Soft continuity across visits.' },
          { key: 'off', label: 'Off', hint: 'Each session a clean slate.' },
        ]}
        selected={prefs.memory_enabled === false ? 'off' : 'on'}
        onSelect={handleMemorySave}
        onClose={closeSheet}
      />
      <CheckInTimesSheet
        visible={activeSheet === 'checkin'}
        options={CHECK_IN_TIME_OPTIONS}
        initialValue={prefs.check_in_times ?? []}
        onSave={handleCheckInTimesSave}
        onClose={closeSheet}
      />
      <RadioSheet
        visible={activeSheet === 'therapist'}
        kicker="— therapist style"
        title="How do you want me to sound?"
        options={THERAPIST_STYLE_OPTIONS}
        selected={prefs.therapist_style}
        onSelect={handleTherapistStyleSave}
        onClose={closeSheet}
      />

      {/* Sign-out confirmation — replaces the OS Alert popup so the
       *  experience matches the rest of the app's bottom-sheet pattern. */}
      <SignOutBottomSheet
        visible={signOutSheetOpen}
        onClose={() => setSignOutSheetOpen(false)}
        onSignOut={handleSignOutConfirm}
        loading={signingOut}
      />

      {/* Delete-account confirmation — type-to-confirm gate, calls
       *  the ECS backend's DELETE /rest/v1/auth/user, then signs out
       *  locally so RouterGate routes to /welcome. */}
      <DeleteAccountSheet
        visible={deleteSheetOpen}
        loading={deletingAccount}
        errorMessage={deleteError}
        onConfirm={handleDeleteAccountConfirm}
        onClose={() => {
          if (deletingAccount) return;
          setDeleteSheetOpen(false);
          setDeleteError(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSide: { width: 36, height: 36 },
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    color: C.ink,
    letterSpacing: -0.1,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  /* Identity header */
  identity: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  name: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.3,
    color: C.ink,
  },
  subline: {
    marginTop: 4,
    fontFamily: 'JetBrainsMono',
    fontSize: 11,
    color: C.ink3,
    letterSpacing: 0.4,
  },

  /* Sections */
  sections: {
    marginTop: 22,
    gap: 18,
  },
  sectionKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
  },
  sectionCard: {
    marginTop: 8,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rowLabel: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 14,
    color: C.ink,
    flexShrink: 1,
  },
  rowLabelDanger: { color: C.coral },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  rowValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: C.ink2,
    textAlign: 'right',
    flexShrink: 1,
  },

  /* Sign out */
  signOutBtn: {
    marginTop: 6,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line2,
    borderRadius: RADIUS.btn,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtnDim: { opacity: 0.6 },
  signOutText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.coral,
    letterSpacing: 0.2,
  },

  /* Footer */
  footer: {
    marginTop: 30,
    fontFamily: 'JetBrainsMono',
    fontSize: 11,
    letterSpacing: 1.2,
    color: C.ink3,
    textAlign: 'center',
  },
});
