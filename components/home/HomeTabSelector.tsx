/**
 * HomeTabSelector Component
 * Horizontal tab selector with underline indicator
 * Supports swipe sync via animatedIndex prop
 *
 * Features:
 * - Underline follows swipe gesture smoothly
 * - Tap to navigate to specific tab
 * - Badge support for notifications
 *
 * FIXED: No longer reads .value during render
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent, ScrollView } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  SharedValue,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LIGHT_THEME } from '@/components/common/LightGradient';

export interface TabItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
}

interface HomeTabSelectorProps {
  tabs: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  onTabPress?: (index: number) => void;
  animatedIndex?: SharedValue<number>;
}

const TIMING = { duration: 200, easing: Easing.out(Easing.ease) };

export default function HomeTabSelector({
  tabs,
  activeTab,
  onTabChange,
  onTabPress,
  animatedIndex,
}: HomeTabSelectorProps) {
  // ScrollView ref for auto-scrolling
  const scrollViewRef = useRef<ScrollView>(null);

  // Track tab layouts for underline positioning
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);

  // Track active index via React state (updated from animated value)
  const [activeIndex, setActiveIndex] = useState(0);

  // Fallback for non-animated mode
  const fallbackIndex = useSharedValue(
    activeTab ? tabs.findIndex((t) => t.id === activeTab) : 0
  );

  // Use provided animatedIndex or fallback
  const currentIndex = animatedIndex || fallbackIndex;

  // Sync active index from animated value to React state
  // This allows us to update tab styling without reading .value during render
  useAnimatedReaction(
    () => Math.round(currentIndex.value),
    (current, previous) => {
      if (current !== previous && previous !== null) {
        runOnJS(setActiveIndex)(current);
      }
    },
    [currentIndex]
  );

  // Initialize active index
  useEffect(() => {
    if (activeTab) {
      const idx = tabs.findIndex((t) => t.id === activeTab);
      if (idx >= 0) setActiveIndex(idx);
    }
  }, [activeTab, tabs]);

  // Auto-scroll to active tab when index changes
  useEffect(() => {
    if (tabLayouts.length >= tabs.length && scrollViewRef.current) {
      const layout = tabLayouts[activeIndex];
      if (layout) {
        // Scroll to make the tab visible with some padding
        scrollViewRef.current.scrollTo({
          x: Math.max(0, layout.x - 20),
          animated: true,
        });
      }
    }
  }, [activeIndex, tabLayouts, tabs.length]);

  // Handle tab layout measurement
  const handleTabLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      setTabLayouts((prev) => {
        const updated = [...prev];
        updated[index] = { x, width };
        return updated;
      });
    },
    []
  );

  // Handle tab press
  const handleTabPress = useCallback(
    (index: number, tabId: string) => {
      // Update local state immediately for responsive UI
      setActiveIndex(index);

      if (onTabPress) {
        onTabPress(index);
      }
      if (onTabChange) {
        onTabChange(tabId);
      }
      // Update fallback index for non-pager usage
      if (!animatedIndex) {
        fallbackIndex.value = withTiming(index, TIMING);
      }
    },
    [onTabPress, onTabChange, animatedIndex, fallbackIndex]
  );

  // Animated underline style
  const underlineStyle = useAnimatedStyle(() => {
    if (tabLayouts.length < tabs.length) {
      // Layouts not yet measured
      return { opacity: 0 };
    }

    const inputRange = tabs.map((_, i) => i);
    const xOutputRange = tabLayouts.map((layout) => layout.x);
    const widthOutputRange = tabLayouts.map((layout) => layout.width);

    const translateX = interpolate(
      currentIndex.value,
      inputRange,
      xOutputRange,
      'clamp'
    );

    const width = interpolate(
      currentIndex.value,
      inputRange,
      widthOutputRange,
      'clamp'
    );

    return {
      transform: [{ translateX }],
      width,
      opacity: 1,
    };
  }, [tabLayouts, tabs.length]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.tabRow}>
          {tabs.map((tab, index) => {
            // Use React state for active styling (no .value access during render)
            const isActive = index === activeIndex;

            // Get filled icon for active, outlined for inactive
            const iconName = isActive
              ? (tab.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap)
              : tab.icon;

            return (
              <Pressable
                key={tab.id}
                style={styles.tab}
                onPress={() => handleTabPress(index, tab.id)}
                onLayout={(e) => handleTabLayout(index, e)}
              >
                <View style={styles.tabContent}>
                  <Ionicons
                    name={iconName}
                    size={20}
                    color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{tab.badge}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}

          {/* Animated underline that follows swipe */}
          <Animated.View style={[styles.underline, underlineStyle]} />
        </View>
      </ScrollView>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingRight: 20,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    position: 'relative',
  },
  tab: {
    paddingBottom: 14,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabLabel: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  tabLabelInactive: {
    color: 'rgba(255,255,255,0.55)',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
  badge: {
    backgroundColor: '#E53935',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: -1,
  },
});
