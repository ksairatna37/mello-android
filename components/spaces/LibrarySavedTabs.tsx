/**
 * LibrarySavedTabs — segmented Library / Saved toggle for Sound Spaces.
 *
 * Cream2 rounded container, paper pill on the active side with a soft
 * shadow, transparent inactive side. Matches the design system tokens
 * (BRAND only, no inline hex) and respects the lowercase voice rule —
 * labels render with capitalized first letter via Title-case here for
 * readability; the surrounding kicker pattern handles the all-mono
 * voice.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BRAND as C, SHADOW } from '@/components/common/BrandGlyphs';

export type SpacesTab = 'library' | 'saved';

interface Props {
  value: SpacesTab;
  onChange: (next: SpacesTab) => void;
}

const TABS: ReadonlyArray<{ id: SpacesTab; label: string }> = [
  { id: 'library', label: 'Library' },
  { id: 'saved',   label: 'Saved'   },
];

export default function LibrarySavedTabs({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const active = tab.id === value;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onChange(tab.id)}
            activeOpacity={0.85}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelIdle]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    backgroundColor: C.cream2,
    alignSelf: 'stretch',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: C.paper,
    ...SHADOW.sm,
  },
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    letterSpacing: 0.1,
  },
  labelActive: { color: C.ink },
  labelIdle: { color: C.ink3 },
});
