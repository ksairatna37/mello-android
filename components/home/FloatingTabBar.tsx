/**
 * FloatingTabBar Component
 * Standalone dark navbar — uses Expo Router hooks for navigation
 * Rendered OUTSIDE the content card (see _layout.tsx)
 * Icon + label, white active / muted inactive
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

interface TabItem {
  name: string;
  outline: keyof typeof Ionicons.glyphMap;
  filled: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TABS: TabItem[] = [
  { name: 'home', outline: 'home-outline', filled: 'home', label: 'home' },
  { name: 'call', outline: 'mic-outline', filled: 'mic', label: 'voice' },
  { name: 'chat', outline: 'chatbubble-outline', filled: 'chatbubble', label: 'chat' },
  { name: 'settings', outline: 'settings-outline', filled: 'settings', label: 'settings' },
];

export default function FloatingTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  // Extract the first path segment to match against tab names
  const activeSegment = pathname.split('/').filter(Boolean)[0] || 'home';

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isFocused = activeSegment === tab.name;
          const iconName = isFocused ? tab.filled : tab.outline;

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => {
                if (!isFocused) {
                  router.navigate(`/${tab.name}` as any);
                }
              }}
              activeOpacity={0.6}
              style={styles.tab}
            >
              <Ionicons
                name={iconName}
                size={22}
                color={isFocused ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
              />
              <Text style={[styles.label, isFocused ? styles.labelActive : styles.labelInactive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D0D0D',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 14,
    paddingBottom: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Outfit-Regular',
  },
  labelActive: {
    color: '#FFFFFF',
  },
  labelInactive: {
    color: 'rgba(255,255,255,0.4)',
  },
});
