/**
 * FadingScrollView Component
 * Wraps ScrollView content in a MaskedView so the CONTENT itself
 * fades to transparent at scroll edges - like the reference app.
 *
 * The content blurs/fades out naturally, background shows through.
 */

import React from 'react';
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
  return (
    <MaskedView
      style={styles.container}
      maskElement={
        <View style={styles.maskContainer}>
          {/* Top fade: transparent → opaque */}
          <LinearGradient
            colors={['transparent', 'black']}
            style={{ height: topFadeHeight }}
          />

          {/* Middle: fully visible */}
          <View style={styles.solidMask} />

          {/* Bottom fade: opaque → transparent */}
          <LinearGradient
            colors={['black', 'transparent']}
            style={{ height: bottomFadeHeight }}
          />
        </View>
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
  solidMask: {
    flex: 1,
    backgroundColor: 'black',
  },
});

// Keep backward-compatible default export
export default FadingScrollWrapper;
