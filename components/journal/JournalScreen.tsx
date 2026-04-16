/**
 * JournalScreen Component - Light Theme
 * Clean journal list with white cards and soft shadows
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

import JournalEntryCard from './JournalEntryCard';
import JournalEditorScreen from './JournalEditorScreen';
import LightGradient, { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import { getJournalEntries } from '@/utils/melloStorage';
import type { JournalEntry } from '@/utils/melloStorage';

type ScreenMode = 'list' | 'editor';

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<ScreenMode>('list');
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  const paddingTop = insets.top + 12;
  const subtitleH = useSharedValue(16);
  const subtitleOpacity = useSharedValue(1);
  const headerSubtitleText = 'Journal';

  const subtitleAnimStyle = useAnimatedStyle(() => ({
    height: subtitleH.value,
    opacity: subtitleOpacity.value,
    overflow: 'hidden',
  }));

  const loadEntries = useCallback(async () => {
    const data = await getJournalEntries();
    setEntries(data);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleSaved = useCallback(() => {
    setMode('list');
    loadEntries();
  }, [loadEntries]);

  if (mode === 'editor') {
    return (
      <JournalEditorScreen
        onCancel={() => setMode('list')}
        onSaved={handleSaved}
      />
    );
  }

  const renderEntry = ({ item }: { item: JournalEntry }) => (
    <JournalEntryCard entry={item} onPress={() => {}} />
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LightGradient variant="warm" />

      {/* Header */}
      <View style={[styles.header, { paddingTop }]}>
        <Pressable style={styles.headerBtn} hitSlop={8} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.logoText}>mello</Text>
          <Animated.View style={subtitleAnimStyle}>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {headerSubtitleText}
            </Text>
          </Animated.View>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {entries.length === 0 ? (
        // Empty state
        <Animated.View style={styles.emptyContainer} entering={FadeIn.duration(500)}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="book-outline" size={40} color={LIGHT_THEME.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Your Journal</Text>
          <Text style={styles.emptyText}>
            Start writing to process your thoughts{'\n'}and track your emotional journey.
          </Text>
          <Pressable
            style={styles.newEntryButton}
            onPress={() => setMode('editor')}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.newEntryButtonText}>New Entry</Text>
          </Pressable>
        </Animated.View>
      ) : (
        // Entries list
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>YOUR RECENT ENTRIES</Text>
          <FlatList
            data={entries}
            renderItem={renderEntry}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />

          {/* Floating FAB */}
          <Pressable
            style={[styles.fab, { bottom: insets.bottom + 110 }]}
            onPress={() => setMode('editor')}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerSpacer: {
    width: 40,
    height: 40,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  logoText: {
    fontFamily: 'Playwrite',
    fontSize: 26,
    color: '#1A1A1A',
    lineHeight: 32,
    marginBottom: 10,
  },

  headerSubtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    marginTop: 1,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
    paddingBottom: 100,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: LIGHT_THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...CARD_SHADOW,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  newEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LIGHT_THEME.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    marginTop: 8,
    ...CARD_SHADOW,
  },
  newEntryButtonText: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },

  // List
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 160,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LIGHT_THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
});
