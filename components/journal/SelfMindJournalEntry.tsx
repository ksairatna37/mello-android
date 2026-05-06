/**
 * SelfMindJournalEntry — single-entry detail view.
 *
 * 1:1 port of MBJournalEntry in mobile-screens-b.jsx. Reached from
 * SelfMindJournalHome by tapping a card:
 *   router.push(`/journal-entry?id=<entryId>`)
 *
 * Wired to journalService.fetchEntries() — finds the entry by id.
 * Currently read-only; edit / delete will land in a follow-up.
 *
 * Layout:
 *   • Top bar — back chevron + title (date) + ellipsis
 *   • Kicker (source: "from your voice session" / "tonight's writing"
 *     / "from a journal prompt")
 *   • Fraunces h1 with italic emphasis (the entry title)
 *   • Tag chips
 *   • Italic blockquote (first sentence of body, or full body if short)
 *   • Long-form body paragraphs
 *   • Butter "thought to carry" card (we synthesize from body's
 *     last sentence if no explicit "carry" field exists)
 *   • Continue this / Share as card CTAs
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
import {
  fetchEntries,
  type JournalEntry,
} from '@/services/journal/journalService';

/* ─── Helpers ─────────────────────────────────────────────────────── */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHeaderDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = DAY_LABELS[d.getDay()];
  const date = d.getDate();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase()
    .replace(' ', '');
  return `${day} · ${date} · ${time}`;
}

function sourceKicker(source: JournalEntry['source']): string {
  if (source === 'voice') return 'FROM YOUR VOICE SESSION';
  if (source === 'prompt') return 'FROM A JOURNAL PROMPT';
  return 'WRITTEN BY YOU';
}

/** Pull the first sentence (or the whole body if short) for the
 *  italic blockquote. Splits on `. ` and keeps the period. */
function firstSentence(text: string | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^[\s\S]+?[.!?](?=\s|$)/);
  return m ? m[0].trim() : trimmed.slice(0, 200);
}

/** Pull the LAST sentence as a "thought to carry" — if there isn't
 *  one, return null (we'll skip the card). */
function lastSentence(text: string | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const matches = trimmed.match(/[^.!?]+[.!?]/g);
  if (!matches) return null;
  return matches[matches.length - 1].trim();
}

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function SelfMindJournalEntry() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const entryId = typeof params.id === 'string' ? params.id : null;

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!entryId) {
      setLoadError('missing entry id');
      return;
    }
    (async () => {
      console.log('[JournalEntry] fetching entry id=' + entryId);
      const result = await fetchEntries();
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      const found = result.data.find((e) => e.id === entryId) ?? null;
      if (!found) {
        console.warn('[JournalEntry] entry not found in blob');
        setLoadError('entry not found');
        return;
      }
      console.log('[JournalEntry] loaded:', found.title);
      setEntry(found);
    })();
    return () => { cancelled = true; };
  }, [entryId]);

  const headerDate = useMemo(
    () => (entry ? formatHeaderDate(entry.createdAt) : ''),
    [entry],
  );
  const blockquote = useMemo(() => firstSentence(entry?.body), [entry?.body]);
  const carry = useMemo(() => lastSentence(entry?.body), [entry?.body]);
  const restOfBody = useMemo(() => {
    if (!entry?.body) return '';
    if (!blockquote) return entry.body;
    // Strip the first sentence if it appears at the start
    return entry.body.startsWith(blockquote)
      ? entry.body.slice(blockquote.length).trim()
      : entry.body;
  }, [entry?.body, blockquote]);

  const handleContinueThis = useCallback(() => {
    if (!entry) return;
    Alert.alert('Coming soon', 'Continuing a thread will open the chat with this entry as context — wiring landing in the next pass.');
  }, [entry]);

  const handleShareAsCard = useCallback(() => {
    Alert.alert('Coming soon', 'Share-as-card export isn’t wired up yet.');
  }, []);

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
        <Text style={styles.title}>{headerDate || ' '}</Text>
        <TouchableOpacity
          onPress={() => console.log('[JournalEntry] more tapped')}
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
          {!entry && !loadError ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={C.ink} />
            </View>
          ) : loadError ? (
            <Text style={styles.errorText}>{loadError}</Text>
          ) : entry ? (
            <>
              <Text style={styles.kicker}>{sourceKicker(entry.source)}</Text>
              <Text style={styles.headline}>{entry.title}</Text>

              {/* Tag chips */}
              {Array.isArray(entry.tags) && entry.tags.length > 0 && (
                <View style={styles.chipsRow}>
                  {entry.tags.map((t) => (
                    <View key={t} style={styles.chip}>
                      <Text style={styles.chipText}>#{t}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Italic blockquote */}
              {!!blockquote && (
                <View style={styles.blockquoteWrap}>
                  <Text style={styles.blockquote}>{`“${blockquote}”`}</Text>
                </View>
              )}

              {/* Long-form body */}
              {!!restOfBody && (
                <Text style={styles.body}>{restOfBody}</Text>
              )}

              {/* Thought to carry — synthesized from last sentence */}
              {!!carry && (
                <View style={styles.carryCard}>
                  <Text style={styles.carryKicker}>A THOUGHT TO CARRY</Text>
                  <Text style={styles.carryText}>{carry}</Text>
                </View>
              )}

              {/* CTAs */}
              <View style={styles.ctaRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSoft]}
                  onPress={handleContinueThis}
                  activeOpacity={0.85}
                >
                  <Glyphs.Sparkle size={14} color={C.ink} />
                  <Text style={styles.btnSoftText}>Continue this</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={handleShareAsCard}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnGhostText}>Share as card</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </ScrollView>
      </FadingScrollWrapper>
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
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 14,
    color: C.ink,
    letterSpacing: -0.05,
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
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.3,
    color: C.ink,
  },

  chipsRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: C.cream2,
  },
  chipText: {
    fontFamily: 'Fraunces-Text',
    fontSize: 11,
    color: C.ink2,
    letterSpacing: 0.1,
  },

  blockquoteWrap: {
    marginTop: 22,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: C.line,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  blockquote: {
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.1,
    color: C.ink,
  },
  body: {
    marginTop: 20,
    fontFamily: 'Fraunces-Text',
    fontSize: 15,
    lineHeight: 25,
    color: C.ink2,
    letterSpacing: 0.05,
  },

  /* Carry card */
  carryCard: {
    marginTop: 22,
    backgroundColor: C.butter,
    borderRadius: RADIUS.card,
    padding: 18,
  },
  carryKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: C.ink3,
  },
  carryText: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.1,
    color: C.ink,
  },

  /* CTAs */
  ctaRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.btn,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.line2,
  },
  btnGhostText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink,
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
