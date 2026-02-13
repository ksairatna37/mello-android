/**
 * AuroraGradient Component
 * OPTIMIZED V2 - Single SVG approach with custom colors support
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  RadialGradient,
  Ellipse,
  Stop,
} from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Default colors (warm pink/peach - age screen)
const DEFAULT_GRADIENT: readonly [string, string, ...string[]] = ['#D0C0C8', '#B8A8B0', '#907080', '#604050', '#3D2030', '#E8A0B0'];
const DEFAULT_GRADIENT_LOCATIONS: readonly [number, number, ...number[]] = [0, 0.18, 0.36, 0.54, 0.78, 1];
const DEFAULT_BLOB_COLORS = [
  '#1A0D18', '#2D1525', '#4A2838', '#6A4555',
  '#D4907A', '#F0A8B8', '#E8A0B0', '#E8B098',
  '#D8B8C8', '#E0909A', '#C08070', '#251520',
];

interface AuroraGradientProps {
  gradientColors?: readonly [string, string, ...string[]];
  gradientLocations?: readonly [number, number, ...number[]];
  blobColors?: string[];
}

// Blob positions (constant - never change)
const BLOB_POSITIONS = [
  { cx: 0.5, cy: 0.95, rx: 0.9, ry: 0.5, opacity: 1 },
  { cx: 0.4, cy: 1, rx: 1, ry: 0.9, opacity: 0.85 },
  { cx: 0.5, cy: 0.55, rx: 0.9, ry: 0.4, opacity: 0.6 },
  { cx: 0.2, cy: 0.5, rx: 0.55, ry: 0.35, opacity: 0.25 },
  { cx: 0.65, cy: 0.2, rx: 0.7, ry: 0.35, opacity: 0.55 },
  { cx: 0.3, cy: 0.15, rx: 0.6, ry: 0.3, opacity: 0.35 },
  { cx: 0.5, cy: 0.25, rx: 0.55, ry: 0.28, opacity: 0.3 },
  { cx: 0.5, cy: 0.05, rx: 0.7, ry: 0.25, opacity: 0.4 },
  { cx: 0.1, cy: 0.1, rx: 0.5, ry: 0.2, opacity: 0.25 },
  { cx: 0.15, cy: 0.4, rx: 0.45, ry: 0.25, opacity: 0.2 },
  { cx: 0.5, cy: 0.4, rx: 0.5, ry: 0.28, opacity: 0.2 },
  { cx: 0.85, cy: 0.7, rx: 0.9, ry: 0.9, opacity: 1 },
];

// Pre-calculate pixel positions
const BLOB_PIXELS = BLOB_POSITIONS.map((b, i) => ({
  ...b,
  cxPx: SCREEN_WIDTH * b.cx,
  cyPx: SCREEN_HEIGHT * b.cy,
  rxPx: SCREEN_WIDTH * b.rx,
  ryPx: SCREEN_HEIGHT * b.ry,
  id: `grad${i}`,
}));

const AuroraGradient = memo(({
  gradientColors = DEFAULT_GRADIENT,
  gradientLocations = DEFAULT_GRADIENT_LOCATIONS,
  blobColors = DEFAULT_BLOB_COLORS,
}: AuroraGradientProps) => {
  // Combine positions with colors
  const blobs = useMemo(() => {
    return BLOB_PIXELS.map((blob, i) => ({
      ...blob,
      color: blobColors[i] || DEFAULT_BLOB_COLORS[i],
    }));
  }, [blobColors]);

  return (
    <View style={styles.container}>
      {/* Base gradient */}
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        style={StyleSheet.absoluteFill}
      />

      {/* Single SVG with all blobs */}
      <Svg
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {blobs.map((blob) => (
            <RadialGradient
              key={blob.id}
              id={blob.id}
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop offset="0%" stopColor={blob.color} stopOpacity={blob.opacity} />
              <Stop offset="15%" stopColor={blob.color} stopOpacity={blob.opacity * 0.9} />
              <Stop offset="30%" stopColor={blob.color} stopOpacity={blob.opacity * 0.7} />
              <Stop offset="45%" stopColor={blob.color} stopOpacity={blob.opacity * 0.45} />
              <Stop offset="60%" stopColor={blob.color} stopOpacity={blob.opacity * 0.25} />
              <Stop offset="75%" stopColor={blob.color} stopOpacity={blob.opacity * 0.1} />
              <Stop offset="90%" stopColor={blob.color} stopOpacity={blob.opacity * 0.03} />
              <Stop offset="100%" stopColor={blob.color} stopOpacity="0" />
            </RadialGradient>
          ))}
        </Defs>

        {blobs.map((blob) => (
          <Ellipse
            key={blob.id}
            cx={blob.cxPx}
            cy={blob.cyPx}
            rx={blob.rxPx}
            ry={blob.ryPx}
            fill={`url(#${blob.id})`}
          />
        ))}
      </Svg>
    </View>
  );
});

export default AuroraGradient;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
