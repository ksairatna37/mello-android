/**
 * SelfMindJournalHome — journal index (PROFILE → Journal entry point).
 *
 * 1:1 port of MBJournalHome in mobile-screens-b.jsx, wired to the
 * `journal_entries` endpoint via services/journal/journalService.
 *
 * Layout:
 *   • Top bar: empty title + Plus glyph (compose new entry — TODO)
 *   • Kicker "your journal" + Fraunces h1 with italic emphasis
 *   • Filter chip row (all · voice · text · prompts · saved)
 *   • Entry list — date pill + title + tags. Color of the date pill
 *     cycles through the brand palette so the list reads as a strip
 *     of distinct moments rather than a uniform feed.
 *   • Empty state (no entries) — soft message + a "Start a voice
 *     session" CTA pointing at /call.
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
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import {
  fetchEntries,
  SAVED_CHAT_TAG,
  type JournalEntry,
  type JournalSource,
} from '@/services/journal/journalService';
import { formatRelativeTime } from '@/services/chat/chatService';
import { chatNavStore } from '@/utils/chatNavStore';

/* ─── Constants ───────────────────────────────────────────────────── */

const FILTERS: ReadonlyArray<{ id: 'all' | JournalSource | 'saved'; label: string }> = [
  { id: 'all',     label: 'all' },
  { id: 'voice',   label: 'voice' },
  { id: 'text',    label: 'text' },
  { id: 'prompt',  label: 'prompts' },
  { id: 'saved',   label: 'saved' },
];

/** Cycles through the brand palette for date-pill color. Stable across
 *  renders because it keys off the entry id, not the array index. */
const PILL_COLORS = [C.peach, C.sage, C.lavender, C.coral, C.butter];
function pillColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PILL_COLORS[h % PILL_COLORS.length];
}

const DAY_LABELS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function entryDayDate(iso: string): { day: string; date: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { day: '—', date: '—' };
  return { day: DAY_LABELS[d.getDay()], date: String(d.getDate()) };
}

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function SelfMindJournalHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<typeof FILTERS[number]['id']>('all');
  /* `refreshing` drives the RefreshControl spinner. Separate from the
   * `entries === null` initial-load skeleton so a manual pull doesn't
   * blank out the existing list — it shows the spinner over current
   * data, then swaps in fresh data when the fetch resolves. */
  const [refreshing, setRefreshing] = useState(false);

  /* Load on mount AND on every focus. Saved-chats are journal entries
   * with source==='chat' — they live in the same blob, so a single GET
   * surfaces everything. No cross-blob merging required. */
  const load = useCallback(async () => {
    console.log('[JournalHome] load');
    const result = await fetchEntries();
    if (result.ok) {
      console.log('[JournalHome] entries=' + result.data.length);
      setEntries(result.data);
      setLoadError(null);
    } else {
      setEntries([]);
      setLoadError(result.error);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    console.log('[JournalHome] pull-to-refresh');
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  /* Filter chip → entries shown.
   *
   * Saved chats live in the same `entries` blob as everything else
   * (source==='chat', tag SAVED_CHAT_TAG). No cross-blob merging.
   *   - all     → every entry
   *   - voice   → only voice-session entries
   *   - text    → only text-composer entries
   *   - prompt  → only nightly-prompt entries
   *   - saved   → entries tagged saved-chat OR legacy 'saved'
   */
  const visibleEntries = useMemo<JournalEntry[] | null>(() => {
    if (!entries) return null;
    if (filter === 'all') return entries;
    if (filter === 'saved') {
      return entries.filter((e) => {
        const tags = e.tags ?? [];
        return tags.includes(SAVED_CHAT_TAG) || tags.includes('saved');
      });
    }
    return entries.filter((e) => e.source === filter);
  }, [entries, filter]);

  const handleNewEntry = useCallback(() => {
    console.log('[JournalHome] new entry → /journal-prompt');
    router.push('/journal-prompt' as any);
  }, [router]);

  const handleEntryTap = useCallback((id: string) => {
    console.log('[JournalHome] entry tapped → /journal-entry?id=' + id);
    router.push(`/journal-entry?id=${id}` as any);
  }, [router]);

  /* Saved-chat entries route to /chat with a synthesised select-session
   * payload — chatNavStore expects a ChatListItem-shaped object so we
   * adapt the journal entry's chatId/chatType into one. */
  const handleSavedChatTap = useCallback((entry: JournalEntry) => {
    if (!entry.chatId) {
      console.warn('[JournalHome] saved-chat entry missing chatId, id=' + entry.id);
      return;
    }
    console.log('[JournalHome] saved-chat tapped → /chat id=' + entry.chatId);
    chatNavStore.push({
      type: 'select-session',
      session: {
        id: entry.chatId,
        title: entry.title || 'Saved chat',
        updated_at: entry.createdAt,
        type: entry.chatType ?? null,
      },
    });
    router.navigate('/chat' as any);
  }, [router]);

  const handleStartVoice = useCallback(() => {
    router.push('/call' as any);
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar — back chevron (always routes to /home for a
       *    predictable destination), centred spacer, new-entry sparkle. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.85}
          onPress={() => router.replace('/home' as any)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.topSide} />
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.85}
          onPress={handleNewEntry}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Sparkle size={18} color={C.ink} />
        </TouchableOpacity>
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 120 + insets.bottom },
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
          <Text style={styles.kicker}>YOUR JOURNAL</Text>
          <Text style={styles.headline}>
            The long, <Text style={styles.headlineItalic}>quiet</Text> story of you.
          </Text>

          {/* Filter chip row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {FILTERS.map((f) => {
              const on = filter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  activeOpacity={0.85}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Entry list / loading / empty */}
          {entries === null ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={C.ink} />
            </View>
          ) : visibleEntries && visibleEntries.length > 0 ? (
            <View style={styles.entryList}>
              {visibleEntries.map((e) => {
                /* Saved-chat entries get a chat-style card (swatch +
                 * mic/chat glyph + "saved chat" tag) so they read
                 * differently from prompt/voice/text entries. */
                if (e.source === 'chat') {
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={styles.entryCard}
                      activeOpacity={0.85}
                      onPress={() => handleSavedChatTap(e)}
                    >
                      <View style={[styles.chatSwatch, { backgroundColor: pillColor(e.id) }]}>
                        {e.chatType === 'voicechat'
                          ? <Glyphs.Mic size={18} color={C.ink} />
                          : <Glyphs.Chat size={18} color={C.ink} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryTitle} numberOfLines={2}>{e.title}</Text>
                        <View style={styles.chatTagRow}>
                          <View style={styles.savedTag}>
                            <Glyphs.Book size={10} color={C.lavenderDeep} />
                            <Text style={styles.savedTagText}>saved chat</Text>
                          </View>
                          <Text style={styles.entryMeta}>
                            {formatRelativeTime(e.createdAt) || ''}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }

                const { day, date } = entryDayDate(e.createdAt);
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.entryCard}
                    activeOpacity={0.85}
                    onPress={() => handleEntryTap(e.id)}
                  >
                    <View style={[styles.datePill, { backgroundColor: pillColor(e.id) }]}>
                      <Text style={styles.dateDay}>{day}</Text>
                      <Text style={styles.dateNum}>{date}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle} numberOfLines={2}>{e.title}</Text>
                      <Text style={styles.entryMeta}>
                        {e.mood ? `#${e.mood}` : ''}
                        {e.mood && e.source ? ' · ' : ''}
                        {e.source ? e.source : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            /* Empty state */
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyKicker}>
                {filter === 'saved' ? 'NOTHING SAVED — YET' : 'NOTHING HERE — YET'}
              </Text>
              <Text style={styles.emptyTitle}>
                {filter === 'saved' ? (
                  <>Nothing <Text style={styles.emptyTitleItalic}>kept</Text> yet.</>
                ) : (
                  <>Your journal is <Text style={styles.emptyTitleItalic}>quiet</Text> for now.</>
                )}
              </Text>
              <Text style={styles.emptyBody}>
                {filter === 'saved'
                  ? 'Long-press a chat in History and tap Save to journal — it will land here, ready to come back to.'
                  : 'Voice sessions save here automatically. Written entries land the moment you close them.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={handleStartVoice}
                activeOpacity={0.9}
              >
                <Glyphs.Mic size={14} color={C.cream} />
                <Text style={styles.emptyCtaText}>Start with a voice session</Text>
              </TouchableOpacity>
              {!!loadError && (
                <Text style={styles.errorText}>
                  Couldn’t reach the server — pull down to retry.
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
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
  topSide: { width: 36, height: 36 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
  },
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.4,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },

  chipsRow: {
    paddingTop: 18,
    paddingBottom: 4,
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line2,
    backgroundColor: C.paper,
  },
  chipOn: {
    backgroundColor: C.ink,
    borderColor: 'transparent',
  },
  chipText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    color: C.ink2,
  },
  chipTextOn: { color: C.cream },

  /* Entry list */
  entryList: {
    marginTop: 22,
    gap: 12,
  },
  entryCard: {
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  datePill: {
    width: 52,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
    flexShrink: 0,
  },
  dateDay: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9,
    letterSpacing: 1,
    color: C.ink,
  },
  dateNum: {
    marginTop: 2,
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: C.ink,
  },
  entryTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.1,
    color: C.ink,
  },
  entryMeta: {
    marginTop: 8,
    fontFamily: 'JetBrainsMono',
    fontSize: 11,
    color: C.ink3,
    letterSpacing: 0.5,
  },

  /* Saved-chat card pieces */
  chatSwatch: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chatTagRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  savedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: C.cream2,
    borderWidth: 1,
    borderColor: C.line,
  },
  savedTagText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9,
    letterSpacing: 1.2,
    color: C.lavenderDeep,
    textTransform: 'uppercase',
  },

  /* Loading + empty */
  loadingWrap: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyWrap: {
    marginTop: 32,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  emptyKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: C.ink3,
  },
  emptyTitle: {
    marginTop: 12,
    fontFamily: 'Fraunces-Medium',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
    color: C.ink,
    textAlign: 'center',
  },
  emptyTitleItalic: { fontFamily: 'Fraunces-MediumItalic' },
  emptyBody: {
    marginTop: 12,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5,
    lineHeight: 20,
    color: C.ink2,
    textAlign: 'center',
    maxWidth: 280,
    letterSpacing: 0.1,
  },
  emptyCta: {
    marginTop: 20,
    backgroundColor: C.ink,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: RADIUS.btn,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyCtaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.1,
  },
  errorText: {
    marginTop: 14,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 12,
    color: C.coral,
    textAlign: 'center',
  },
});
