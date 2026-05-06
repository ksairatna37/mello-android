/**
 * SelfMindNotifications — soft-prompt center (bell tap from Home).
 *
 * Surface for nudges Mello sends you: check-ins, weekly summaries,
 * voice follow-ups, and soft practice suggestions. Local-first for
 * now — no backend required.
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import {
  dismissNotification,
  generateHomeNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type MelloNotification,
  type NotificationKind,
} from '@/services/notifications/notificationService';
import { getNotificationCopy } from '@/services/home/notificationCopy';

export default function SelfMindNotifications() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<MelloNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unread = useMemo(() => items.filter((item) => !item.readAt).length, [items]);
  const headerCopy = useMemo(
    () => getNotificationCopy({
      unread,
      total: items.length,
      loading,
      kinds: items.map((item) => item.kind),
    }),
    [items, loading, unread],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    await generateHomeNotifications();
    const next = await listNotifications();
    setItems(next);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const handleOpen = useCallback(async (item: MelloNotification) => {
    await markNotificationRead(item.id);
    setItems((current) =>
      current.map((n) => (
        n.id === item.id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n
      )),
    );
    if (!item.route) return;
    if (item.params) {
      router.push({ pathname: item.route, params: item.params } as any);
      return;
    }
    router.push(item.route as any);
  }, [router]);

  const handleDismiss = useCallback(async (id: string) => {
    await dismissNotification(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setItems((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
    );
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          style={styles.iconBtn}
          activeOpacity={0.85}
          disabled={unread === 0}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Check size={17} color={unread > 0 ? C.ink : C.ink3} />
        </TouchableOpacity>
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.ink2} colors={[C.coral]} />
          }
        >
          <Text style={styles.kicker}>{headerCopy.kicker}</Text>
          <Text style={styles.headline}>
            {headerCopy.headline}{' '}
            <Text style={styles.headlineItalic}>{headerCopy.emphasis}</Text>.
          </Text>
      

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={C.ink} />
              <Text style={styles.loadingText}>checking the little tray…</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyOrb} />
              <Text style={styles.emptyTitle}>You{'’'}re all caught up.</Text>
              <Text style={styles.emptySub}>
                Come back tonight — there might be a soft prompt waiting.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {items.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  onOpen={() => void handleOpen(item)}
                  onDismiss={() => void handleDismiss(item.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
}

function NotificationCard({
  item,
  onOpen,
  onDismiss,
}: {
  item: MelloNotification;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const unread = !item.readAt;
  const Icon = iconFor(item.kind);
  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.88}
      style={[styles.card, unread && styles.cardUnread]}
    >
      <View style={[styles.glyphWrap, { backgroundColor: swatchFor(item.kind) }]}>
        <Icon size={17} color={C.ink} />
      </View>
      <View style={styles.cardCopy}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardEyebrow}>{item.eyebrow}</Text>
          {unread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardBody}>{item.body}</Text>
        <Text style={styles.cardTime}>{relativeTime(item.createdAt)}</Text>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        style={styles.dismissBtn}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Glyphs.Close size={14} color={C.ink3} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function iconFor(kind: NotificationKind) {
  switch (kind) {
    case 'weekly_reflection': return Glyphs.Moon;
    case 'mood_pattern': return Glyphs.Wave;
    case 'voice_followup': return Glyphs.Mic;
    case 'journal_prompt': return Glyphs.Book;
    case 'practice_nudge': return Glyphs.Breath;
    case 'sound_space': return Glyphs.Sound;
    case 'daily_checkin':
    default:
      return Glyphs.Bell;
  }
}

function swatchFor(kind: NotificationKind): string {
  switch (kind) {
    case 'weekly_reflection': return C.lavender;
    case 'mood_pattern': return C.peach;
    case 'voice_followup': return C.sage;
    case 'journal_prompt': return C.butter;
    case 'practice_nudge': return C.lavender;
    case 'sound_space': return C.peach;
    case 'daily_checkin':
    default:
      return C.coral;
  }
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const min = Math.max(0, Math.floor(diffMs / 60_000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
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
    // Per docs/ANDROID_TEXT_CROPPING_NOTE.md — "waiting" descenders clip
    // on Android. fontSize+8 + no padding override.
    lineHeight: 47,
    letterSpacing: -0.4,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  body: {
    marginTop: 14,
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    lineHeight: 21,
    color: C.ink2,
    letterSpacing: 0.1,
  },

  emptyCard: {
    marginTop: 28,
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 22,
    alignItems: 'center',
    overflow: 'hidden',
  },
  emptyOrb: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.peach,
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 18,
    letterSpacing: -0.2,
    color: C.ink,
  },
  emptySub: {
    marginTop: 8,
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    lineHeight: 19,
    color: C.ink2,
    textAlign: 'center',
  },
  loadingCard: {
    marginTop: 28,
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 22,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    color: C.ink2,
  },
  list: {
    marginTop: 26,
    gap: 10,
  },
  card: {
    minHeight: 118,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.paper,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  cardUnread: {
    borderColor: C.line2,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  glyphWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26,31,54,0.07)',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTopRow: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardEyebrow: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1.5,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.coral,
  },
  cardTitle: {
    marginTop: 5,
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.15,
    color: C.ink,
  },
  cardBody: {
    marginTop: 5,
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    lineHeight: 19,
    color: C.ink2,
  },
  cardTime: {
    marginTop: 10,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
