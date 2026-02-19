/**
 * HorizontalPager Component
 * Swipeable horizontal pager with gesture support
 *
 * Features:
 * - Snap-to-page on swipe
 * - Spring animation for natural momentum
 * - Exposes animated index for tab indicator sync
 * - Each page has independent vertical scroll
 *
 * FIXED: Layout issues with flex, gesture conflicts with ScrollView
 */

import React, { useCallback, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  SharedValue,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Timing config for smooth animation (no bounce)
const TIMING_CONFIG = {
  duration: 300,
  easing: Easing.out(Easing.cubic),
};

// Swipe threshold (30% of screen width or velocity)
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const VELOCITY_THRESHOLD = 500;

export interface HorizontalPagerRef {
  scrollToPage: (index: number) => void;
  getCurrentPage: () => number;
}

interface HorizontalPagerProps {
  pages: React.ReactNode[];
  initialPage?: number;
  onPageChange?: (index: number) => void;
  animatedIndex?: SharedValue<number>;
}

const HorizontalPager = forwardRef<HorizontalPagerRef, HorizontalPagerProps>(
  ({ pages, initialPage = 0, onPageChange, animatedIndex }, ref) => {
    const pageCount = pages.length;

    // Internal animated value for page position (0 to pageCount-1)
    const internalIndex = useSharedValue(initialPage);
    const translateX = useSharedValue(-initialPage * SCREEN_WIDTH);

    // Use external animatedIndex if provided, otherwise use internal
    const currentIndex = animatedIndex || internalIndex;

    // Track gesture state
    const startX = useSharedValue(0);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      scrollToPage: (index: number) => {
        const clampedIndex = Math.max(0, Math.min(index, pageCount - 1));
        translateX.value = withTiming(-clampedIndex * SCREEN_WIDTH, TIMING_CONFIG);
        currentIndex.value = withTiming(clampedIndex, TIMING_CONFIG);
        if (animatedIndex && animatedIndex !== currentIndex) {
          animatedIndex.value = withTiming(clampedIndex, TIMING_CONFIG);
        }
        onPageChange?.(clampedIndex);
      },
      getCurrentPage: () => Math.round(-translateX.value / SCREEN_WIDTH),
    }));

    const notifyPageChange = useCallback(
      (index: number) => {
        onPageChange?.(index);
      },
      [onPageChange]
    );

    // Pan gesture for swiping between pages
    // activeOffsetX prevents conflict with vertical ScrollView inside pages
    const panGesture = Gesture.Pan()
      .activeOffsetX([-15, 15]) // Require 15px horizontal movement before activating
      .failOffsetY([-15, 15])   // Fail if vertical movement exceeds 15px first
      .onStart(() => {
        startX.value = translateX.value;
      })
      .onUpdate((event) => {
        // Calculate new position
        const newX = startX.value + event.translationX;

        // Clamp to valid range with rubber band effect at edges
        const minX = -(pageCount - 1) * SCREEN_WIDTH;
        const maxX = 0;

        if (newX > maxX) {
          // Rubber band at start
          translateX.value = newX * 0.3;
        } else if (newX < minX) {
          // Rubber band at end
          const overflow = minX - newX;
          translateX.value = minX - overflow * 0.3;
        } else {
          translateX.value = newX;
        }

        // Update animated index for tab indicator sync
        const rawIndex = -translateX.value / SCREEN_WIDTH;
        const clampedRawIndex = Math.max(0, Math.min(rawIndex, pageCount - 1));
        currentIndex.value = clampedRawIndex;
        if (animatedIndex && animatedIndex !== currentIndex) {
          animatedIndex.value = clampedRawIndex;
        }
      })
      .onEnd((event) => {
        const currentPage = Math.round(-startX.value / SCREEN_WIDTH);
        let targetPage = currentPage;

        // Determine target page based on velocity or distance
        if (Math.abs(event.velocityX) > VELOCITY_THRESHOLD) {
          // Velocity-based navigation
          targetPage = event.velocityX > 0 ? currentPage - 1 : currentPage + 1;
        } else if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
          // Distance-based navigation
          targetPage = event.translationX > 0 ? currentPage - 1 : currentPage + 1;
        }

        // Clamp to valid range
        targetPage = Math.max(0, Math.min(targetPage, pageCount - 1));

        // Animate to target page
        translateX.value = withTiming(-targetPage * SCREEN_WIDTH, TIMING_CONFIG);
        currentIndex.value = withTiming(targetPage, TIMING_CONFIG);
        if (animatedIndex && animatedIndex !== currentIndex) {
          animatedIndex.value = withTiming(targetPage, TIMING_CONFIG);
        }

        // Notify page change
        if (targetPage !== currentPage) {
          runOnJS(notifyPageChange)(targetPage);
        }
      });

    // Animated style for pages container
    const pagesStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    return (
      <View style={styles.container}>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.pagesContainer,
              { width: SCREEN_WIDTH * pageCount },
              pagesStyle,
            ]}
          >
            {pages.map((page, index) => (
              <View key={index} style={styles.page}>
                {page}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      </View>
    );
  }
);

HorizontalPager.displayName = 'HorizontalPager';

export default HorizontalPager;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  pagesContainer: {
    flexDirection: 'row',
    height: '100%',
  },
  page: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
});
