/**
 * SubtleAuroraGradient Component
 * Gentle, soothing aurora effect for daily-use screens
 *
 * OPTIMIZED FOR PERFORMANCE:
 * - memo() prevents re-renders
 * - Pre-calculated pixel positions (no runtime math)
 * - Static SVG (no animation = no JS thread work)
 * - Minimal blob count (4-6 for visual effect without cost)
 * - shouldComponentUpdate: false via memo
 *
 * Design principles:
 * - Very soft, muted colors (cream, blush, lavender)
 * - Low opacity blobs (max 0.12-0.2)
 * - Warm base that doesn't tire the eyes
 * - Subtle enough for repeated daily viewing
 */

import React, { memo } from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  RadialGradient,
  Ellipse,
  Stop,
} from 'react-native-svg';

// Cache dimensions once (avoid re-calculating on every render)
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Soft cream/warm base gradient
const BASE_GRADIENT: readonly [string, string, ...string[]] = [
  '#FBF9F7',  // Very soft warm white
  '#F8F5F2',  // Cream
  '#F5F2EE',  // Warmer cream
  '#F2EEE8',  // Soft beige hint
];

const GRADIENT_LOCATIONS: readonly [number, number, ...number[]] = [0, 0.33, 0.66, 1];

// Subtle blob configuration - ONLY 5 blobs for performance
// Each blob is strategically placed for visual balance
const BLOB_CONFIG = [
  // Soft pink blush - top right corner
  { cx: 0.75, cy: 0.12, rx: 0.55, ry: 0.22, color: '#F5E1E0', opacity: 0.8 },

  // Soft lavender - center left edge8
  { cx: 0.1, cy: 0.45, rx: 0.45, ry: 0.28, color: '#E8E0F0', opacity: 0.8 },

  // Warm peach glow - bottom area
  { cx: 0.55, cy: 0.88, rx: 0.7, ry: 0.35, color: '#F5E8E0', opacity: 0.8 },

  // Soft mint - bottom right
  { cx: 0.9, cy: 0.65, rx: 0.45, ry: 0.3, color: '#E5F2EE', opacity: 0.8 },

  // Warm cream highlight - center (ties it together)
  { cx: 0.45, cy: 0.5, rx: 0.6, ry: 0.35, color: '#FFF8F0', opacity: 0.8 },
] as const;

// Pre-calculate ALL pixel positions at module load (zero runtime cost)
const BLOBS = BLOB_CONFIG.map((b, i) => ({
  cxPx: SCREEN_WIDTH * b.cx,
  cyPx: SCREEN_HEIGHT * b.cy,
  rxPx: SCREEN_WIDTH * b.rx,
  ryPx: SCREEN_HEIGHT * b.ry,
  color: b.color,
  opacity: b.opacity,
  id: `sag-${i}`,
  // Pre-calculate opacity stops too
  op0: b.opacity,
  op1: b.opacity * 0.75,
  op2: b.opacity * 0.45,
  op3: b.opacity * 0.2,
  op4: b.opacity * 0.05,
}));

// Static gradient definitions (pre-computed, never changes)
const GradientDefs = memo(() => (
  <Defs>
    {BLOBS.map((blob) => (
      <RadialGradient
        key={blob.id}
        id={blob.id}
        cx="50%"
        cy="50%"
        rx="50%"
        ry="50%"
      >
        <Stop offset="0%" stopColor={blob.color} stopOpacity={blob.op0} />
        <Stop offset="25%" stopColor={blob.color} stopOpacity={blob.op1} />
        <Stop offset="50%" stopColor={blob.color} stopOpacity={blob.op2} />
        <Stop offset="75%" stopColor={blob.color} stopOpacity={blob.op3} />
        <Stop offset="100%" stopColor={blob.color} stopOpacity={blob.op4} />
      </RadialGradient>
    ))}
  </Defs>
));
GradientDefs.displayName = 'GradientDefs';

// Static ellipses (pre-computed positions)
const GradientBlobs = memo(() => (
  <>
    {BLOBS.map((blob) => (
      <Ellipse
        key={blob.id}
        cx={blob.cxPx}
        cy={blob.cyPx}
        rx={blob.rxPx}
        ry={blob.ryPx}
        fill={`url(#${blob.id})`}
      />
    ))}
  </>
));
GradientBlobs.displayName = 'GradientBlobs';

/**
 * Main component - memo ensures it NEVER re-renders
 * since it has no props and produces static output
 */
const SubtleAuroraGradient = memo(() => {
  return (
    <View style={styles.container} pointerEvents="none">
      {/* Warm base gradient - hardware accelerated */}
      <LinearGradient
        colors={BASE_GRADIENT}
        locations={GRADIENT_LOCATIONS}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Subtle aurora blobs - single SVG element */}
      <Svg
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        style={styles.svg}
      >
        <GradientDefs />
        <GradientBlobs />
      </Svg>
    </View>
  );
});

SubtleAuroraGradient.displayName = 'SubtleAuroraGradient';

export default SubtleAuroraGradient;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  svg: {
    ...StyleSheet.absoluteFillObject,
    // Hardware acceleration hint on Android
    ...(Platform.OS === 'android' && { renderToHardwareTextureAndroid: true }),
  },
});
