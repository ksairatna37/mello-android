/**
 * FadingEdges — premium edge-fade for scrollable screens.
 *
 * Uses two absolute-positioned LinearGradients (top + bottom) that blend
 * the screen background into transparent over the scrolling content.
 * Visually identical to the old MaskedView-based FadingScrollWrapper, but
 * NO native masking → no Android transition artifacts, no compositing
 * bugs, no dark shading during stack push/pop.
 *
 * Pass the screen's background color so the gradient starts from the
 * exact color behind the scroll content (cream by default).
 *
 * Usage:
 *   <View style={{ flex: 1, backgroundColor: BRAND.cream }}>
 *     <TopBar />
 *     <FadingEdges bg={BRAND.cream} topFadeHeight={32} bottomFadeHeight={64}>
 *       <ScrollView>...</ScrollView>
 *     </FadingEdges>
 *   </View>
 */
import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  children: ReactNode;
  bg: string;             // solid hex, e.g. BRAND.cream
  topFadeHeight?: number;
  bottomFadeHeight?: number;
}

/** Convert a `#RRGGBB` to `#RRGGBB00` (same color, fully transparent). */
function transparent(hex: string) {
  // Already has alpha? Just set it to 0.
  if (hex.startsWith('#') && (hex.length === 9)) return hex.slice(0, 7) + '00';
  if (hex.startsWith('#')) return hex + '00';
  // Fallback for rgba / named colors — blend to rgba(0,0,0,0).
  return 'rgba(0,0,0,0)';
}

export function FadingEdges({
  children,
  bg,
  topFadeHeight = 32,
  bottomFadeHeight = 64,
}: Props) {
  const fade = transparent(bg);

  return (
    <View style={styles.wrap}>
      {children}
      <LinearGradient
        pointerEvents="none"
        colors={[bg, fade]}
        style={[styles.edge, { top: 0, height: topFadeHeight }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[fade, bg]}
        style={[styles.edge, { bottom: 0, height: bottomFadeHeight }]}
      />
    </View>
  );
}

export default FadingEdges;

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
