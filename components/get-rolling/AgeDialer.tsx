/**
 * AgeDialer Component
 * Simple, performant horizontal age picker
 */

import React, { useRef, useMemo, memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Vibration,
  Platform,
  ScrollView,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = 80;
const CIRCLE_SIZE = 110;
const CONTAINER_HEIGHT = 140;
const SIDE_PADDING = (SCREEN_WIDTH - ITEM_WIDTH) / 2;

// DEBUG: Track renders
let renderCount = 0;

// Memoized age item to prevent re-renders
const AgeItem = memo(({ age }: { age: number }) => {
  return (
    <View style={styles.ageItem}>
      <Text style={styles.ageText}>{age}</Text>
    </View>
  );
});

interface AgeDialerProps {
  minAge?: number;
  maxAge?: number;
  initialAge?: number;
  onAgeChange: (age: number) => void;
}

function AgeDialer({
  minAge = 13,
  maxAge = 100,
  initialAge = 18,
  onAgeChange,
}: AgeDialerProps) {
  renderCount++;
  console.log(`[AgeDialer] Render #${renderCount}`);

  const lastAge = useRef(initialAge);

  const handleScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / ITEM_WIDTH);
    const newAge = Math.min(Math.max(minAge + index, minAge), maxAge);

    console.log(`[AgeDialer] ScrollEnd - offset: ${offsetX}, index: ${index}, newAge: ${newAge}`);

    if (newAge !== lastAge.current) {
      lastAge.current = newAge;
      Vibration.vibrate(Platform.OS === 'ios' ? 5 : 20);
      onAgeChange(newAge);
    }
  };

  // Memoize items array to prevent recreation on every render
  const items = useMemo(() => {
    console.log(`[AgeDialer] Creating items array (${minAge} to ${maxAge})`);
    const arr = [];
    for (let age = minAge; age <= maxAge; age++) {
      arr.push(<AgeItem key={age} age={age} />);
    }
    return arr;
  }, [minAge, maxAge]);

  return (
    <View style={styles.container}>
      <View style={styles.centerIndicator} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        contentOffset={{ x: (initialAge - minAge) * ITEM_WIDTH, y: 0 }}
        onMomentumScrollEnd={handleScrollEnd}
        removeClippedSubviews={true}
      >
        {items}
      </ScrollView>
    </View>
  );
}

export default memo(AgeDialer);

const styles = StyleSheet.create({
  container: {
    height: CONTAINER_HEIGHT,
    justifyContent: 'center',
  },
  centerIndicator: {
    position: 'absolute',
    left: (SCREEN_WIDTH - CIRCLE_SIZE) / 2,
    top: (CONTAINER_HEIGHT - CIRCLE_SIZE) / 2,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: SIDE_PADDING,
    alignItems: 'center',
  },
  ageItem: {
    width: ITEM_WIDTH,
    height: CONTAINER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageText: {
    fontSize: 46,
    fontFamily: 'Outfit-Bold',
    color: 'rgba(255, 255, 255, 0.4)',
  },
});
