/**
 * FadingScrollView Component
 * Wraps ScrollView content in a MaskedView so the CONTENT itself
 * fades to transparent at scroll edges - like the reference app.
 *
 * The content blurs/fades out naturally, background shows through.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface FadingScrollWrapperProps {
  children: React.ReactNode;
  topFadeHeight?: number;
  bottomFadeHeight?: number;
}

export const FadingScrollWrapper = ({
  children,
  topFadeHeight = 50,
  bottomFadeHeight = 80,
}: FadingScrollWrapperProps) => {
  const [height, setHeight] = useState(800);

  const topStop = Math.min(topFadeHeight / height, 0.15);
  const bottomStop = Math.max(1 - bottomFadeHeight / height, 0.85);

  return (
    <MaskedView
      style={styles.container}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      maskElement={
        <LinearGradient
          colors={['transparent', 'black', 'black', 'transparent']}
          locations={[0, topStop, bottomStop, 1]}
          style={styles.maskContainer}
        />
      }
    >
      {children}
    </MaskedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  maskContainer: {
    flex: 1,
  },
});

// Keep backward-compatible default export
export default FadingScrollWrapper;
