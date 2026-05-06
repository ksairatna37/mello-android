/**
 * FadingScrollWrapper — overlay-gradient edge fade.
 *
 * Implementation history (so future-you doesn't reopen settled debates):
 *
 *   v1 — `@react-native-masked-view/masked-view` with a luminance-mask
 *        gradient. Zero-config (the screen's bg shows through naturally),
 *        but Android-broken: during native-stack back transitions
 *        react-native-screens recomposites the outgoing screen and the
 *        mask bleeds through as a dark gradient over the scroll body.
 *
 *   v1a — same MaskedView with `androidRenderingMode="software"`.
 *        Documented workaround in masked-view PR #127. Verified on this
 *        codebase: the dark scrim still appears AND adds noticeable lag
 *        on lower-end Android. Not a viable path.
 *
 *   v2 (current) — two absolute LinearGradients painting `bg → transparent`
 *        on top of the content. No native masking, no transition artifact,
 *        no lag. Cost: the wrapper needs to know the screen's bg color so
 *        the gradient blends cleanly. Default is `BRAND.cream`, which is
 *        the canvas for the vast majority of screens. The ~3 non-cream
 *        screens (peach name-input, peach welcome-aboard, tonal
 *        QuestionPage) pass `bg={C.peach}` etc.
 */

import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '@/components/common/BrandGlyphs';

interface FadingScrollWrapperProps {
  children: ReactNode;
  topFadeHeight?: number;
  bottomFadeHeight?: number;
  /** Screen background — used for both edges if `topBg`/`bottomBg` aren't
   *  set. Defaults to BRAND.cream (the common case). */
  bg?: string;
  /** Top-edge color override. Use when the top of the screen has a tone
   *  wash (peach, sage, lavender, butter) and the bottom is plain cream
   *  — passing `bg` alone would tint one edge wrong. */
  topBg?: string;
  /** Bottom-edge color override. Same intent as `topBg`. */
  bottomBg?: string;
}

/** Convert `#RRGGBB` (or `#RRGGBBAA`) to the same RGB with alpha = 00. */
function transparent(hex: string): string {
  if (hex.startsWith('#') && hex.length === 9) return hex.slice(0, 7) + '00';
  if (hex.startsWith('#') && hex.length === 7) return hex + '00';
  if (hex.startsWith('#') && hex.length === 4) {
    const r = hex[1], g = hex[2], b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}00`;
  }
  return 'rgba(0,0,0,0)';
}

export const FadingScrollWrapper = ({
  children,
  topFadeHeight = 50,
  bottomFadeHeight = 80,
  bg = BRAND.cream,
  topBg,
  bottomBg,
}: FadingScrollWrapperProps) => {
  const top = topBg ?? bg;
  const bottom = bottomBg ?? bg;
  const topFade = transparent(top);
  const bottomFade = transparent(bottom);

  return (
    <View style={styles.wrap}>
      {children}
      <LinearGradient
        pointerEvents="none"
        colors={[top, topFade]}
        style={[styles.edge, { top: 0, height: topFadeHeight }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[bottomFade, bottom]}
        style={[styles.edge, { bottom: 0, height: bottomFadeHeight }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});

export default FadingScrollWrapper;
