/**
 * SelfMindVoiceSummary — post-call summary surface.
 *
 * 1:1 port of MBVoiceSummary in mobile-screens-a.jsx. Reached after a
 * voice session ends — VoiceAgentScreen calls
 *   router.replace(`/voice-summary?id=<sessionId>`)
 * once finalizeVoiceSession has resolved.
 *
 * Backend reads:
 *   - GET /rest/v1/voice_sessions?user_id=<u>&id=<s> for the single
 *     session row (transcript, summary, top_emotions, duration).
 *   - voice_user_profiles isn't read here — the summary is per-session,
 *     not per-user.
 *
 * Layout (verbatim from design):
 *   • Top bar — back chevron + ellipsis
 *   • Kicker "tue · 9:48pm · 14 min" (formatted from started_at + duration)
 *   • Headline "What you came in with."
 *   • Peach card with the session's reflective opening line (first user
 *     turn from the transcript) — italicized inline phrase
 *   • Kicker "what came up" + chip row of top_emotions
 *   • Kicker "one thing to hold" + ink card with model-generated takeaway
 *   • Save to journal / Set a gentle reminder CTAs
 *
 * "Save to journal" creates a JournalEntry from the session (title +
 * summary as body, source: 'voice', tags: [emotion names]).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { useAuth } from '@/contexts/AuthContext';
import { authGet } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getAccessToken } from '@/services/auth';
import { addEntry as addJournalEntry } from '@/services/journal/journalService';
import { createVoiceFollowup } from '@/services/notifications/notificationService';

/* ─── Types from voice_sessions ───────────────────────────────────── */

interface VoiceTranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  emotions?: Array<{ name: string; score: number }>;
}

interface VoiceSession {
  id: string;
  user_id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript: VoiceTranscriptEntry[] | null;
  summary: string | null;
  top_emotions: Array<{ name: string; score: number }> | null;
  status: 'active' | 'ended' | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function formatHeaderKicker(startedIso: string | null, durationSec: number | null): string {
  if (!startedIso) return '';
  const d = new Date(startedIso);
  if (isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase()
    .replace(' ', '');
  const min = durationSec ? `${Math.max(1, Math.round(durationSec / 60))} min` : '';
  return [day, time, min].filter(Boolean).join(' · ');
}

/** Pick first non-empty user turn — that's "what they came in with." */
function firstUserTurn(transcript: VoiceTranscriptEntry[] | null): string | null {
  if (!transcript) return null;
  for (const t of transcript) {
    if (t.role === 'user' && t.text.trim().length > 0) return t.text.trim();
  }
  return null;
}

/* Short-list emotion → palette swatch for the chip row. Cycles through
 * the brand palette so the chips read as varied moments. */
const CHIP_COLORS = [C.lavender, C.sage, C.butter, C.coral, C.peach];

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function SelfMindVoiceSummary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { state } = useAuth();

  const sessionId = typeof params.id === 'string' ? params.id : null;
  const userId = state.kind === 'authed' ? state.userId : null;

  const [session, setSession] = useState<VoiceSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingToJournal, setSavingToJournal] = useState(false);

  /* Fetch the single session row */
  useEffect(() => {
    let cancelled = false;
    if (!sessionId || !userId) {
      setLoadError('missing session id');
      return;
    }
    (async () => {
      console.log('[VoiceSummary] fetching session id=' + sessionId);
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setLoadError('not authenticated');
        return;
      }
      const url =
        `${ENDPOINTS.VOICE_SESSIONS}?user_id=${encodeURIComponent(userId)}` +
        `&id=${encodeURIComponent(sessionId)}`;
      const { data, error } = await authGet<VoiceSession[] | VoiceSession>(url, token);
      if (cancelled) return;

      if (error) {
        console.error('[VoiceSummary] fetch error:', error);
        setLoadError(error.message || 'load failed');
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setLoadError('session not found');
        return;
      }
      console.log(
        '[VoiceSummary] loaded — turns=' + (row.transcript?.length ?? 0),
        'emotions=' + (row.top_emotions?.length ?? 0),
      );
      setSession(row);
    })();
    return () => { cancelled = true; };
  }, [sessionId, userId]);

  const headerKicker = useMemo(
    () => formatHeaderKicker(session?.started_at ?? null, session?.duration_seconds ?? null),
    [session?.started_at, session?.duration_seconds],
  );
  const opener = useMemo(() => firstUserTurn(session?.transcript ?? null), [session?.transcript]);
  const emotions = (session?.top_emotions ?? []).slice(0, 5);
  const summary = session?.summary?.trim() || null;

  const handleSaveToJournal = useCallback(async () => {
    if (!session || savingToJournal) return;
    setSavingToJournal(true);
    console.log('[VoiceSummary] saving session ' + session.id + ' to journal');
    const result = await addJournalEntry({
      title: summary?.slice(0, 80) || (opener ? opener.slice(0, 80) : 'Voice session'),
      body: summary || (opener ?? ''),
      source: 'voice',
      mood: emotions[0]?.name?.toLowerCase(),
      tags: emotions.slice(0, 3).map((e) => e.name.toLowerCase()),
    });
    setSavingToJournal(false);
    if (result.ok) {
      Alert.alert('Saved', 'This session is now in your journal.', [
        { text: 'Open journal', onPress: () => router.replace('/journal' as any) },
        { text: 'Stay here', style: 'cancel' },
      ]);
    } else {
      Alert.alert("Couldn't save", result.error);
    }
  }, [session, summary, opener, emotions, router, savingToJournal]);

  const handleReminder = useCallback(() => {
    if (!session) return;

    const schedule = async (when: Date) => {
      const item = await createVoiceFollowup({
        sessionId: session.id,
        summary,
        when,
      });
      Alert.alert(
        'Reminder set',
        item.nativeNotificationId
          ? 'I’ll bring this back softly when the time comes.'
          : 'Saved in notifications. Native alerts need notification permission.',
      );
    };

    Alert.alert(
      'Set a gentle reminder',
      'When should Mello bring this back?',
      [
        { text: 'In 1 hour', onPress: () => { void schedule(addHours(new Date(), 1)); } },
        { text: 'Tonight', onPress: () => { void schedule(nextAt(21, 0)); } },
        { text: 'Tomorrow morning', onPress: () => { void schedule(nextAt(9, 30, true)); } },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [session, summary]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Session</Text>
        <TouchableOpacity
          onPress={() => console.log('[VoiceSummary] more tapped')}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.More size={18} color={C.ink} />
        </TouchableOpacity>
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 80 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {!session && !loadError ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={C.ink} />
            </View>
          ) : loadError ? (
            <Text style={styles.errorText}>{loadError}</Text>
          ) : (
            <>
              {!!headerKicker && (
                <Text style={styles.kicker}>{headerKicker.toUpperCase()}</Text>
              )}
              <Text style={styles.headline}>
                What you{' '}
                <Text style={styles.headlineItalic}>came in with</Text>.
              </Text>

              {/* Peach card — opener line. Falls back to a soft
                  default if the transcript was too short. */}
              <View style={styles.peachCard}>
                <Text style={styles.peachText}>
                  {opener
                    ? opener
                    : 'A few minutes you brought to the room. That itself counts.'}
                </Text>
              </View>

              {/* What came up — emotion chips */}
              {emotions.length > 0 && (
                <View style={{ marginTop: 22 }}>
                  <Text style={styles.kicker}>WHAT CAME UP</Text>
                  <View style={styles.chipsRow}>
                    {emotions.map((e, i) => (
                      <View
                        key={e.name + i}
                        style={[
                          styles.chip,
                          { backgroundColor: CHIP_COLORS[i % CHIP_COLORS.length] },
                        ]}
                      >
                        <Text style={styles.chipText}>{e.name.toLowerCase()}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* One thing to hold — ink card with summary */}
              {!!summary && (
                <View style={{ marginTop: 22 }}>
                  <Text style={styles.kicker}>ONE THING TO HOLD</Text>
                  <View style={styles.inkCard}>
                    <Text style={styles.inkText}>{summary}</Text>
                  </View>
                </View>
              )}

              {/* CTAs */}
              <View style={styles.ctaRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSoft]}
                  onPress={handleSaveToJournal}
                  disabled={savingToJournal}
                  activeOpacity={0.85}
                >
                  {savingToJournal ? (
                    <ActivityIndicator color={C.ink} size="small" />
                  ) : (
                    <Text style={styles.btnSoftText}>Save to journal</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={handleReminder}
                  activeOpacity={0.9}
                >
                  <Text style={styles.btnPrimaryText}>Set a gentle reminder</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
}

function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function nextAt(hour: number, minute: number, forceTomorrow = false): Date {
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (forceTomorrow || next.getTime() <= Date.now() + 60_000) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    color: C.ink,
    letterSpacing: -0.1,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
  },
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.3,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },

  /* Peach card */
  peachCard: {
    marginTop: 20,
    backgroundColor: C.peach,
    borderRadius: RADIUS.card,
    padding: 20,
  },
  peachText: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.1,
    color: C.ink,
  },

  /* Chip row */
  chipsRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  chipText: {
    fontFamily: 'Fraunces-Italic',
    fontSize: 13,
    color: C.ink,
    letterSpacing: 0.05,
  },

  /* Ink card (one thing to hold) */
  inkCard: {
    marginTop: 10,
    backgroundColor: C.ink,
    borderRadius: RADIUS.card,
    padding: 22,
  },
  inkText: {
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.1,
    color: C.cream,
  },

  /* CTAs */
  ctaRow: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSoft: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line2,
  },
  btnSoftText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink,
    letterSpacing: 0.1,
  },
  btnPrimary: { backgroundColor: C.ink },
  btnPrimaryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.1,
  },

  /* Loading / error */
  loadingWrap: { marginTop: 60, alignItems: 'center' },
  errorText: {
    marginTop: 40,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 14,
    color: C.coral,
    textAlign: 'center',
  },
});
