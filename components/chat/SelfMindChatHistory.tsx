/**
 * SelfMindChatHistory — full chat archive in Claude design.
 *
 * Reached from the History icon in SelfMindChatHome's top-right. Lists
 * every saved thread (text + voice) with relative time, swatch, and
 * starred indicator. Long-press opens an action sheet (rename / star /
 * delete) reusing the existing RenameChatSheet + DeleteChatSheet.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { useAuth } from '@/contexts/AuthContext';
import {
  getChats,
  deleteChat,
  starChat,
  updateTitle,
  formatRelativeTime,
  type ChatListItem,
} from '@/services/chat/chatService';
import {
  fetchEntries,
  saveChatAsEntry,
  unsaveChatEntry,
} from '@/services/journal/journalService';
import { chatNavStore } from '@/utils/chatNavStore';
import RenameChatSheet from './RenameChatSheet';
import DeleteChatSheet from './DeleteChatSheet';
import { threadVisualFor } from './threadVisuals';

export default function SelfMindChatHistory() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useAuth();
  const userId = state.kind === 'authed' ? state.userId : null;

  const [threads, setThreads] = useState<ChatListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /* Set<chatId> of chats currently saved to journal — derived from
   * journal_entries.entries[] where source==='chat'. Refreshed on focus
   * and after every save/unsave action. */
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());

  const [menuFor, setMenuFor] = useState<ChatListItem | null>(null);
  const [renameFor, setRenameFor] = useState<ChatListItem | null>(null);
  const [deleteFor, setDeleteFor] = useState<ChatListItem | null>(null);

  const refreshSavedSet = useCallback(async () => {
    const result = await fetchEntries();
    if (!result.ok) {
      console.warn('[ChatHistory] saved-entries fetch failed:', result.error);
      return;
    }
    const ids = new Set<string>();
    for (const e of result.data) {
      if (e.source === 'chat' && e.chatId) ids.add(e.chatId);
    }
    console.log('[ChatHistory] savedSet size=' + ids.size);
    setSavedSet(ids);
  }, []);

  const load = useCallback(async () => {
    if (!userId) {
      console.log('[ChatHistory] no userId — skipping');
      setThreads([]);
      return;
    }
    console.log('[ChatHistory] loading…');
    try {
      const [items] = await Promise.all([
        getChats(userId, 200),
        refreshSavedSet(),
      ]);
      console.log('[ChatHistory] loaded', items.length, 'threads');
      setThreads(items);
      setLoadError(null);
    } catch (err: any) {
      console.error('[ChatHistory] load error:', err?.message ?? err);
      setThreads([]);
      setLoadError(err?.message ?? 'load failed');
    }
  }, [userId, refreshSavedSet]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleRefresh = useCallback(async () => {
    console.log('[ChatHistory] pull-to-refresh');
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const grouped = useMemo(() => {
    if (!threads) return [] as { label: string; items: ChatListItem[] }[];
    const now = Date.now();
    const dayMs = 86_400_000;
    const buckets: Record<string, ChatListItem[]> = {
      'today': [],
      'this week': [],
      'earlier': [],
    };
    for (const t of threads) {
      const ts = new Date(t.updated_at).getTime();
      const age = now - ts;
      if (age < dayMs) buckets.today.push(t);
      else if (age < 7 * dayMs) buckets['this week'].push(t);
      else buckets.earlier.push(t);
    }
    return [
      { label: 'today', items: buckets.today },
      { label: 'this week', items: buckets['this week'] },
      { label: 'earlier', items: buckets.earlier },
    ].filter((g) => g.items.length > 0);
  }, [threads]);

  const handleOpen = useCallback((t: ChatListItem) => {
    console.log('[ChatHistory] open', t.id);
    chatNavStore.push({ type: 'select-session', session: t });
    router.navigate('/chat' as any);
  }, [router]);

  const handleStar = useCallback(async () => {
    if (!menuFor) return;
    const next = !menuFor.is_starred;
    console.log('[ChatHistory] star', menuFor.id, next);
    setMenuFor(null);
    await starChat(menuFor.id, next);
    await load();
  }, [menuFor, load]);

  const handleSaveToJournal = useCallback(async () => {
    if (!menuFor) return;
    const isSaved = savedSet.has(menuFor.id);
    console.log('[ChatHistory] save→journal', menuFor.id, 'currentlySaved=' + isSaved);
    const target = menuFor; // capture before clearing
    setMenuFor(null);

    if (isSaved) {
      const result = await unsaveChatEntry(target.id);
      if (!result.ok) console.warn('[ChatHistory] unsave failed:', result.error);
    } else {
      const result = await saveChatAsEntry({
        chatId: target.id,
        title: target.title,
        chatType: target.type === 'voicechat' ? 'voicechat' : 'textchat',
      });
      if (!result.ok) console.warn('[ChatHistory] save failed:', result.error);
    }
    await refreshSavedSet();
  }, [menuFor, savedSet, refreshSavedSet]);

  const handleRenameSave = useCallback(async (newTitle: string) => {
    if (!renameFor) return;
    console.log('[ChatHistory] rename', renameFor.id, '→', newTitle);
    await updateTitle(renameFor.id, newTitle);
    // If this chat has a journal entry, sync the title there too — the
    // partial unique index makes saveChatAsEntry an upsert.
    if (savedSet.has(renameFor.id)) {
      try {
        await saveChatAsEntry({
          chatId: renameFor.id,
          title: newTitle,
          chatType: (renameFor.type === 'voicechat' ? 'voicechat' : 'textchat'),
        });
      } catch (err) {
        console.warn('[ChatHistory] rename: journal sync failed', err);
      }
    }
    setRenameFor(null);
    await load();
  }, [renameFor, savedSet, load]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteFor) return;
    console.log('[ChatHistory] delete', deleteFor.id);
    await deleteChat(deleteFor.id);
    // If the deleted chat was saved to journal, drop the orphan entry too.
    try { await unsaveChatEntry(deleteFor.id); } catch (err) {
      console.warn('[ChatHistory] orphan-cleanup failed', err);
    }
    setDeleteFor(null);
    await load();
  }, [deleteFor, load]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.replace('/chats' as any)}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
        <View style={{ width: 36 }} />
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
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
          <Text style={styles.kicker}>EVERY THREAD, KEPT GENTLY</Text>
          <Text style={styles.headline}>
            What you{'’'}ve <Text style={styles.headlineItalic}>said before</Text>.
          </Text>

          {threads === null ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={C.ink} />
            </View>
          ) : threads.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>
                Nothing to look back on{' '}
                <Text style={styles.emptyTitleItalic}>yet</Text>.
              </Text>
              <Text style={styles.emptyBody}>
                When you start a thread, it lands here — quiet, kept, yours to revisit.
              </Text>
              {!!loadError && (
                <Text style={styles.errorText}>Couldn’t reach the server — pull down to retry.</Text>
              )}
            </View>
          ) : (
            grouped.map((g) => (
              <View key={g.label} style={{ marginTop: 22 }}>
                <Text style={styles.kicker}>{g.label.toUpperCase()}</Text>
                <View style={styles.list}>
                  {g.items.map((t) => {
                    const visual = threadVisualFor(t);
                    const ThreadIcon = visual.Icon;

                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={styles.row}
                        onPress={() => handleOpen(t)}
                        onLongPress={() => setMenuFor(t)}
                        activeOpacity={0.85}
                        delayLongPress={280}
                      >
                        <View
                          style={[
                            styles.swatch,
                            { backgroundColor: visual.bg, borderColor: visual.border },
                          ]}
                        >
                          <ThreadIcon size={17} color={visual.iconColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.preview} numberOfLines={2}>
                            {t.title}
                          </Text>
                          <Text style={styles.when}>
                            {formatRelativeTime(t.updated_at) || '—'}
                          </Text>
                          {savedSet.has(t.id) && (
                            <View style={styles.savedTag}>
                              <Glyphs.Book size={10} color={C.lavenderDeep ?? C.ink2} />
                              <Text style={styles.savedTagText}>saved to journal</Text>
                            </View>
                          )}
                        </View>
                        {t.is_starred && (
                          <View style={styles.starDot}>
                            <Glyphs.Heart size={11} color={C.coral} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </FadingScrollWrapper>

      {/* Long-press action sheet */}
      <Modal
        visible={!!menuFor}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuFor(null)}>
          <Pressable style={styles.menuCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.menuTitle} numberOfLines={1}>
              {menuFor?.title ?? ''}
            </Text>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => { const t = menuFor; setMenuFor(null); setRenameFor(t); }}
              activeOpacity={0.8}
            >
              <Text style={styles.menuLabel}>Rename</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuRow} onPress={handleStar} activeOpacity={0.8}>
              <Text style={styles.menuLabel}>
                {menuFor?.is_starred ? 'Unstar' : 'Star'}
              </Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuRow} onPress={handleSaveToJournal} activeOpacity={0.8}>
              <Text style={styles.menuLabel}>
                {menuFor && savedSet.has(menuFor.id) ? 'Remove from journal' : 'Save to journal'}
              </Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => { const t = menuFor; setMenuFor(null); setDeleteFor(t); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuLabel, { color: C.coral }]}>Delete</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <RenameChatSheet
        visible={!!renameFor}
        currentTitle={renameFor?.title ?? ''}
        onClose={() => setRenameFor(null)}
        onSave={handleRenameSave}
      />
      <DeleteChatSheet
        visible={!!deleteFor}
        chatTitle={deleteFor?.title ?? ''}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDeleteConfirm}
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
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.4,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },

  list: { marginTop: 10, gap: 10 },
  row: {
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  swatch: {
    width: 44, height: 44, borderRadius: 14,
    borderWidth: 1,
    flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  when: {
    marginTop: 3,
    fontFamily: 'JetBrainsMono',
    fontSize: 10,
    letterSpacing: 0.5,
    color: C.ink3,
  },
  preview: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    color: C.ink,
  },
  savedTag: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
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
    color: C.ink2,
    textTransform: 'uppercase',
  },
  starDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.cream2,
    alignItems: 'center', justifyContent: 'center',
  },

  loadingWrap: { marginTop: 60, alignItems: 'center' },
  emptyWrap: { marginTop: 32, paddingHorizontal: 12 },
  emptyTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: C.ink,
  },
  emptyTitleItalic: { fontFamily: 'Fraunces-MediumItalic' },
  emptyBody: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5,
    lineHeight: 20,
    color: C.ink2,
    letterSpacing: 0.1,
  },
  errorText: {
    marginTop: 14,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 12,
    color: C.coral,
  },

  /* Long-press menu */
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,31,54,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  menuCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: C.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  menuTitle: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 1.6,
    color: C.ink3,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  menuRow: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  menuLabel: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    color: C.ink,
    letterSpacing: -0.1,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.line,
  },
});
