/**
 * SelfMindChatHome — chat thread index (CHAT tab landing).
 *
 * 1:1 visual port of MBChatHome in mobile-screens-a.jsx, wired to the
 * REST-migrated chat backend:
 *   - `getChats(userId)` reads the user's chat blob from /load/chat
 *   - "Start new thread" pushes via `chatNavStore` and navigates to
 *     /chat where the legacy `ChatScreen` consumes the request and
 *     calls `createChat` / loads the conversation.
 *   - Tap a thread → same pattern with a `select-session` request.
 *
 * Loads on every focus so newly created/ended chats appear without a
 * manual refresh. Empty state surfaces a clear call-to-action so the
 * screen never reads as "broken" for first-time users.
 */

import React, { useCallback, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import {
  getChats,
  formatRelativeTime,
  type ChatListItem,
} from '@/services/chat/chatService';
import { chatNavStore } from '@/utils/chatNavStore';
import { threadVisualFor } from './threadVisuals';

const RECENT_THREAD_LIMIT = 4;

export default function SelfMindChatHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useAuth();

  const [threads, setThreads] = useState<ChatListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const userId = state.kind === 'authed' ? state.userId : null;

  const load = useCallback(async () => {
    if (!userId) {
      console.log('[SelfMindChatHome] no userId — skipping load');
      setThreads([]);
      return;
    }
    console.log('[SelfMindChatHome] loading threads…');
    try {
      const items = await getChats(userId, 50);
      console.log('[SelfMindChatHome] loaded', items.length, 'threads');
      setThreads(items);
      setLoadError(null);
    } catch (err: any) {
      console.error('[SelfMindChatHome] load error:', err?.message ?? err);
      setThreads([]);
      setLoadError(err?.message ?? 'load failed');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    console.log('[SelfMindChatHome] pull-to-refresh');
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const handleNewThread = useCallback(() => {
    console.log('[SelfMindChatHome] new thread tapped');
    chatNavStore.push({ type: 'new-chat' });
    router.navigate('/chat' as any);
  }, [router]);

  const handleOpenHistory = useCallback(() => {
    console.log('[SelfMindChatHome] history tapped');
    router.navigate('/chat-history' as any);
  }, [router]);

  const handleSelectThread = useCallback((session: ChatListItem) => {
    console.log('[SelfMindChatHome] thread selected', session.id);
    chatNavStore.push({ type: 'select-session', session });
    router.navigate('/chat' as any);
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topSide} />
        <View style={styles.topSide} />
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.85}
          onPress={handleOpenHistory}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.History size={18} color={C.ink} />
        </TouchableOpacity>
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 120 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.ink2}
              colors={[C.coral]}
              progressBackgroundColor={C.paper}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>THE CHAT ROOM</Text>
          <Text style={styles.headline}>
            Anything you{'’'}d like to say{' '}
            <Text style={styles.headlineItalic}>out loud</Text>?
          </Text>

          {/* Composer card — always visible, taps trigger new-thread */}
          <TouchableOpacity
            style={styles.composer}
            onPress={handleNewThread}
            activeOpacity={0.85}
          >
            <View style={styles.composerAvatar}>
              <Glyphs.Sparkle size={18} color={C.ink} />
            </View>
            <Text style={styles.composerPlaceholder}>start a new thread…</Text>
            <Glyphs.Mic size={18} color={C.ink2} />
          </TouchableOpacity>

          <Text style={[styles.kicker, { marginTop: 26 }]}>LATELY</Text>

          {threads === null ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={C.ink} />
            </View>
          ) : threads.length > 0 ? (
            <View style={styles.threadList}>
              {threads.slice(0, RECENT_THREAD_LIMIT).map((t) => {
                const visual = threadVisualFor(t);
                const ThreadIcon = visual.Icon;

                return (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.threadRow}
                    onPress={() => handleSelectThread(t)}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.threadSwatch,
                        { backgroundColor: visual.bg, borderColor: visual.border },
                      ]}
                    >
                      <ThreadIcon size={17} color={visual.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.threadPreview} numberOfLines={2}>
                        {t.title}
                      </Text>
                      <Text style={styles.threadWhen}>
                        {formatRelativeTime(t.updated_at) || '—'}
                      </Text>
                    </View>
                    <Glyphs.Arrow size={14} color={C.ink3} />
                  </TouchableOpacity>
                );
              })}
              {threads.length > RECENT_THREAD_LIMIT && (
                <TouchableOpacity
                  style={styles.seeAllRow}
                  onPress={handleOpenHistory}
                  activeOpacity={0.75}
                >
                  <Text style={styles.seeAllText}>SEE ALL</Text>
                  <Glyphs.Arrow size={13} color={C.ink3} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>
                Nothing here{' '}
                <Text style={styles.emptyTitleItalic}>yet</Text>.
              </Text>
              <Text style={styles.emptyBody}>
                Start a thread when there{'’'}s something on your mind. They show up here whenever you come back.
              </Text>
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
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.4,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },

  composer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: C.line,
  },
  composerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.coral,
    alignItems: 'center', justifyContent: 'center',
  },
  composerPlaceholder: {
    flex: 1,
    fontFamily: 'Fraunces-Italic',
    fontSize: 14,
    color: C.ink3,
  },

  threadList: {
    marginTop: 10,
    gap: 10,
  },
  threadRow: {
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  threadSwatch: {
    width: 44, height: 44, borderRadius: 14,
    borderWidth: 1,
    flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  threadWhen: {
    marginTop: 3,
    fontFamily: 'JetBrainsMono',
    fontSize: 10,
    letterSpacing: 0.5,
    color: C.ink3,
  },
  threadPreview: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    color: C.ink,
  },
  seeAllRow: {
    alignSelf: 'center',
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seeAllText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.ink3,
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
});
